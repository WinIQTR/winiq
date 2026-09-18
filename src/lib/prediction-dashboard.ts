// This server-side module is also reused by command-line automation.

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  calculateMarketsFromGoalModel,
} from "@/modules/market-engine";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

import {
  calculateMatchRating,
} from "@/modules/rating-engine";

import {
  rankTopPicks,
  selectPopularPicks,
} from "@/modules/top-picks-engine";

import type {
  DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";

import type {
  MarketEngineResult,
  MarketSelection,
} from "@/modules/market-engine";

import type {
  OutcomeProbabilities,
} from "@/modules/probability-engine";

import {
  savePredictionSelectionAuditSnapshot,
  type PredictionSelectionAuditRecord,
} from "@/lib/prediction-selection-audit-snapshot";

import {
  evaluateSelectionPolicyV2,
} from "@/lib/selection-policy-explanation";

import {
  buildTeamFormMap,
} from "@/lib/team-recent-form";

import {
  buildPopularMarketsSummary,
} from "@/modules/market-engine/build-popular-markets-summary";

import {
  calculateCardsCornersMarkets,
} from "@/modules/market-engine/calculate-cards-corners-market";

import {
  calculateHalfTimeMarkets,
} from "@/modules/market-engine/calculate-half-time-market";

import {
  calculatePlayerGoalscorerMarket,
} from "@/modules/market-engine/calculate-player-goalscorer-market";

export type {
  DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";

export type ProductionCandidateType =
  | "PRIMARY_HOME"
  | "REVIEW_AWAY";

export type ProductionDashboardPrediction =
  DashboardPrediction & {
    productionCandidateType:
      ProductionCandidateType;

    productionScore:
      number;

    dataQualityScore:
      number;

    probabilityGap:
      number;

    fairOdds:
      number;

    leagueMatches:
      number;

    homeVenueMatches:
      number;

    awayVenueMatches:
      number;

    drawAuditWouldApply:
      boolean;

    mlFallback:
      boolean;

    productionModelName:
      string;

    topPicksModelName:
      string;

    topPicksModelVersion:
      string;

    selectionPolicyVersion:
      "selection-policy-v2";
  };

const LIVE_LOOKAHEAD_DAYS =
  60;

const MAXIMUM_MATCH_SCAN =
  300;

/**
 * Calculating 300 matches serially in one web request can leave
 * the page blank for several minutes.
 *
 * A limited number of matches are calculated concurrently to avoid
 * overloading the local PostgreSQL connection.
 */
const WEB_PREDICTION_CONCURRENCY =
  6;

/**
 * Prevent the Dashboard and Predictions page from recalculating the
 * same 300 matches. The cache exists only in the running Next.js
 * server memory and does not change the production model or database.
 */
const WEB_PREDICTION_CACHE_TTL_MS =
  15 * 60 * 1000;

const SELECTION_POLICY_VERSION =
  "selection-policy-v2" as const;

type ProductionPredictionCache = {
  expiresAt:
    number;

  predictions:
    ProductionDashboardPrediction[];
};

let productionPredictionCache:
  ProductionPredictionCache | null =
  null;

let productionPredictionRequest:
  Promise<
    ProductionDashboardPrediction[]
  > | null =
  null;

async function mapWithConcurrency<
  Input,
  Output,
>(
  items: readonly Input[],
  concurrency: number,
  mapper: (
    item: Input,
    index: number,
  ) => Promise<Output>,
): Promise<Output[]> {
  const results =
    new Array<Output>(
      items.length,
    );

  let nextIndex =
    0;

  async function worker(): Promise<void> {
    while (
      true
    ) {
      const currentIndex =
        nextIndex;

      nextIndex +=
        1;

      if (
        currentIndex >=
        items.length
      ) {
        return;
      }

      results[currentIndex] =
        await mapper(
          items[currentIndex],
          currentIndex,
        );
    }
  }

  const workerCount =
    Math.min(
      concurrency,
      items.length,
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker(),
    ),
  );

  return results;
}

function addDays(
  value: Date,
  days: number,
): Date {
  const result =
    new Date(
      value,
    );

  result.setDate(
    result.getDate() +
      days,
  );

  return result;
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function calculateFairOdds(
  probability: number,
): number | null {
  if (
    !Number.isFinite(
      probability,
    ) ||
    probability <=
      0
  ) {
    return null;
  }

  return round(
    100 /
      probability,
  );
}

function isMlFallback(
  productionModelName: string,
): boolean {
  return productionModelName
    .toLocaleLowerCase(
      "en-US",
    )
    .includes(
      "fallback",
    );
}

function calculateProductionScore(
  options: {
    probability:
      number;

    confidence:
      number;

    dataQuality:
      number;

    probabilityGap:
      number;
  },
): number {
  const normalizedGap =
    Math.min(
      (
        options.probabilityGap /
        30
      ) *
        100,
      100,
    );

  return round(
    options.probability *
      0.35 +
      options.confidence *
        0.35 +
      options.dataQuality *
        0.2 +
      normalizedGap *
        0.1,
  );
}

function getPredictedFairOdds(
  prediction:
    Awaited<
      ReturnType<
        typeof generateMatchPrediction
      >
    >,
): number {
  switch (
    prediction.predictedOutcome
  ) {
    case "HOME":
      return prediction
        .finalFairOdds
        .home;

    case "DRAW":
      return prediction
        .finalFairOdds
        .draw;

    case "AWAY":
      return prediction
        .finalFairOdds
        .away;
  }
}

function createUpdatedSelection(
  selection:
    MarketSelection,

  probability:
    number,
): MarketSelection {
  const normalizedProbability =
    round(
      Math.min(
        Math.max(
          probability,
          0,
        ),
        100,
      ),
    );

  return {
    ...selection,

    probability:
      normalizedProbability,

    fairOdds:
      calculateFairOdds(
        normalizedProbability,
      ),
  };
}

/**
 * Goal Model generates the score matrix for every market.
 *
 * Prediction Engine V2 produces the advanced final 1X2 result after
 * Rating Engine and calibration.
 *
 * This function updates only markets derived directly from 1X2:
 *
 * - Match Result
 * - Double Chance
 * - Draw No Bet
 *
 * Goal markets retain their score-matrix values.
 */
function applyFinalOutcomeProbabilitiesToMarkets(
  marketModel:
    MarketEngineResult,

  probabilities:
    OutcomeProbabilities,
): MarketEngineResult {
  const home =
    probabilities.home;

  const draw =
    probabilities.draw;

  const away =
    probabilities.away;

  const decisiveProbability =
    home +
    away;

  const homeDrawNoBet =
    decisiveProbability >
    0
      ? (
          home /
          decisiveProbability
        ) *
        100
      : 50;

  const awayDrawNoBet =
    decisiveProbability >
    0
      ? (
          away /
          decisiveProbability
        ) *
        100
      : 50;

  const probabilityByKey =
    new Map<
      string,
      number
    >([
      [
        "match_result_home",
        home,
      ],

      [
        "match_result_draw",
        draw,
      ],

      [
        "match_result_away",
        away,
      ],

      [
        "double_chance_1x",
        home +
          draw,
      ],

      [
        "double_chance_x2",
        draw +
          away,
      ],

      [
        "double_chance_12",
        home +
          away,
      ],

      [
        "dnb_home",
        homeDrawNoBet,
      ],

      [
        "dnb_away",
        awayDrawNoBet,
      ],
    ]);

  const selections =
    marketModel.selections.map(
      (
        selection,
      ) => {
        const updatedProbability =
          probabilityByKey.get(
            selection.key,
          );

        if (
          updatedProbability ===
          undefined
        ) {
          return selection;
        }

        return createUpdatedSelection(
          selection,
          updatedProbability,
        );
      },
    );

  const topSelections =
    [
      ...selections,
    ]
      .sort(
        (
          first,
          second,
        ) =>
          second.probability -
          first.probability,
      )
      .slice(
        0,
        15,
      );

  return {
    ...marketModel,

    selections,
    topSelections,

    model: {
      ...marketModel.model,

      version:
        `${marketModel.model.version}-prediction-v2`,
    },

    warnings: [
      ...marketModel.warnings,

      "Match Result, Double Chance, and Draw No Bet were updated with the final Prediction Engine V2 probabilities.",
    ],
  };
}

async function calculateDashboardPredictions(): Promise<
  ProductionDashboardPrediction[]
> {
  const activeSeasonYear =
    ACTIVE_SEASON_YEAR;

  const leagueApiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

  if (
    leagueApiIds.length ===
    0
  ) {
    return [];
  }

  const now =
    new Date();

  const liveUntil =
    addDays(
      now,
      LIVE_LOOKAHEAD_DAYS,
    );

  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,

          lt:
            liveUntil,
        },

        season: {
          year:
            activeSeasonYear,

          league: {
            apiId: {
              in:
                leagueApiIds,
            },
          },
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        round:
          true,

        homeTeamId:
          true,

        awayTeamId:
          true,

        seasonId:
          true,

        homeTeam: {
          select: {
            name:
              true,

            logoUrl:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,

            logoUrl:
              true,
          },
        },

        season: {
          select: {
            year:
              true,

            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      take:
        MAXIMUM_MATCH_SCAN,
    });

  // A team cannot have two scheduled fixtures on the same calendar day.
  // Imported feeds occasionally contain a stale/duplicated fixture with a
  // different API id; discard the lower-priority duplicate before generating
  // predictions so it can never enter the published snapshot.
  const occupiedTeamDays = new Set<string>();
  const validMatches = matches.filter((match) => {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(match.kickoffAt);
    const teams = [match.homeTeam.name, match.awayTeam.name].map((team) =>
      team.trim().toLocaleLowerCase("tr-TR"),
    );
    if (teams.some((team) => occupiedTeamDays.has(`${day}|${team}`))) {
      return false;
    }
    teams.forEach((team) => occupiedTeamDays.add(`${day}|${team}`));
    return true;
  });

  const teamFormMap =
    await buildTeamFormMap(
      activeSeasonYear,
    );

  const auditGeneratedAt =
    new Date();

  const selectionAudits:
    PredictionSelectionAuditRecord[] = [];

  const predictionResults =
    await mapWithConcurrency(
      validMatches,
      WEB_PREDICTION_CONCURRENCY,
      async (
        match,
      ): Promise<
        ProductionDashboardPrediction | null
      > => {
    try {
      /**
       * generateMatchPrediction first updates Feature Engine and then
       * produces Prediction Engine V2, Rating Engine, and calibration results.
       */
      const predictionV2 =
        await generateMatchPrediction({
          matchId:
            match.id,
        });

      /**
       * After feature generation, fetch Goal Model and detailed category
       * ratings concurrently.
       */
      const [
        goalModel,
        rating,
      ] =
        await Promise.all([
          calculateGoalProbabilities(
            match.id,
          ),

          calculateMatchRating(
            match.id,
          ),
        ]);

      const originalMarketModel =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      const marketModel =
        applyFinalOutcomeProbabilitiesToMarkets(
          originalMarketModel,
          predictionV2
            .finalProbabilities,
        );

      const cardsCornersMarkets =
        await calculateCardsCornersMarkets(
          match.homeTeamId,
          match.awayTeamId,
          match.seasonId,
        );

      const halfTimeMarkets =
        calculateHalfTimeMarkets(
          goalModel.expectedGoals.home,
          goalModel.expectedGoals.away,
        );

      const playerGoalscorerMarkets =
        await calculatePlayerGoalscorerMarket(
          match.homeTeamId,
          match.awayTeamId,
          match.seasonId,
          goalModel.expectedGoals.home,
          goalModel.expectedGoals.away,
        );

      const popularMarketsSummary =
        buildPopularMarketsSummary(
          [
            ...marketModel.selections,
            ...cardsCornersMarkets,
            ...halfTimeMarkets,
            ...playerGoalscorerMarkets,
          ],
        );

      const topPicksResult =
        rankTopPicks(
          marketModel,
          {
            limit:
              10,

            minimumProbability:
              60,

            minimumHistoricalSamples:
              300,

            minimumFairOdds:
              1.25,

            maximumFairOdds:
              5,

            maximumSelectionsPerMarket:
              1,

            maximumSelectionsPerFamily:
              2,
          },
        );

const popularCandidateResult =
  rankTopPicks(
    marketModel,
    {
      limit:
        50,

      minimumProbability:
        52,

      minimumHistoricalSamples:
        300,

      minimumFairOdds:
        1.25,

      maximumFairOdds:
        4,

      maximumSelectionsPerMarket:
        1,

      maximumSelectionsPerFamily:
        10,
    },
  );

const popularPicks =
  selectPopularPicks(
    popularCandidateResult
      .picks,
  );

      const probabilities =
        predictionV2
          .finalProbabilities;

      const predictedOutcome =
        predictionV2
          .predictedOutcome;

      const predictedProbability =
        predictionV2
          .predictedProbability;

      const confidence =
        predictionV2
          .poissonConfidence;

      const productionModelName =
        predictionV2
          .model
          .productionModelName;

      const mlFallback =
        isMlFallback(
          productionModelName,
        );

      const policyEvaluation =
        evaluateSelectionPolicyV2({
          predictedOutcome,
          predictedProbability,
          confidenceLevel:
            confidence.level,
          confidenceScore:
            confidence.score,
          dataQualityScore:
            confidence.dataQualityScore,
          productionModelName,
          mlFallback,
        });

      selectionAudits.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        evaluatedAt: auditGeneratedAt,
        decision:
          policyEvaluation.decision,
        eligible:
          policyEvaluation.eligible,
        predictedOutcome,
        predictedProbability,
        homeProbability:
          probabilities.home,
        drawProbability:
          probabilities.draw,
        awayProbability:
          probabilities.away,
        expectedHomeGoals:
          goalModel.expectedGoals.home,
        expectedAwayGoals:
          goalModel.expectedGoals.away,
        advisoryMarket:
          topPicksResult.picks[0]
            ?.market ?? null,
        advisorySelection:
          topPicksResult.picks[0]
            ?.selection ?? null,
        advisoryProbability:
          topPicksResult.picks[0]
            ?.probability ?? null,
        advisoryReliabilityScore:
          topPicksResult.picks[0]
            ?.reliabilityScore ?? null,
        confidenceLevel:
          confidence.level,
        confidenceScore:
          confidence.score,
        dataQualityScore:
          confidence.dataQualityScore,
        productionModelName,
        summary:
          policyEvaluation.summary,
        failedCodes:
          policyEvaluation.failedCodes,
        checks:
          policyEvaluation.checks,
      });

      if (
        !policyEvaluation.eligible
      ) {
        return null;
      }

      const productionCandidateType:
        ProductionCandidateType =
        predictedOutcome ===
        "HOME"
          ? "PRIMARY_HOME"
          : "REVIEW_AWAY";

      return {
        matchId:
          match.id,

        kickoffAt:
          match.kickoffAt,

        dataMode:
          "LIVE",

        leagueApiId:
          match
            .season
            .league
            .apiId,

        leagueName:
          match
            .season
            .league
            .name,

        homeTeam:
          match
            .homeTeam
            .name,

        awayTeam:
          match
            .awayTeam
            .name,

        homeTeamId:
          match.homeTeamId,

        awayTeamId:
          match.awayTeamId,

        homeTeamLogo:
          match
            .homeTeam
            .logoUrl,

        homeRecentResults:
          teamFormMap.get(match.homeTeamId) ?? [],

        awayRecentResults:
          teamFormMap.get(match.awayTeamId) ?? [],

        popularMarketsSummary,

        awayTeamLogo:
          match
            .awayTeam
            .logoUrl,

        /**
         * Dashboard and Prediction Card display the final
         * Prediction Engine V2 values directly.
         */
        homeProbability:
          probabilities.home,

        drawProbability:
          probabilities.draw,

        awayProbability:
          probabilities.away,

        predictedOutcome,

        predictedProbability,

        /**
         * Overall card confidence is not only the first Top Pick's
         * reliability value.
         *
         * It uses the combined probability, calibration, and rating score.
         */
        confidenceScore:
          confidence.score,

        confidenceLevel:
          confidence.level,

        productionCandidateType,

        productionScore:
          calculateProductionScore({
            probability:
              predictedProbability,

            confidence:
              confidence.score,

            dataQuality:
              confidence
                .dataQualityScore,

            probabilityGap:
              confidence
                .probabilityGap,
          }),

        dataQualityScore:
          confidence
            .dataQualityScore,

        probabilityGap:
          confidence
            .probabilityGap,

        fairOdds:
          getPredictedFairOdds(
            predictionV2,
          ),

        leagueMatches:
          confidence
            .dataQuality
            .leagueMatches,

        homeVenueMatches:
          confidence
            .dataQuality
            .homeVenueMatches,

        awayVenueMatches:
          confidence
            .dataQuality
            .awayVenueMatches,

        drawAuditWouldApply:
          predictionV2
            .drawDecision
            .applied,

        mlFallback,

        productionModelName,

        topPicksModelName:
          topPicksResult.model.name,

        topPicksModelVersion:
          topPicksResult.model.version,

        selectionPolicyVersion:
          SELECTION_POLICY_VERSION,

        expectedHomeGoals:
          goalModel
            .expectedGoals
            .home,

        expectedAwayGoals:
          goalModel
            .expectedGoals
            .away,

popularPicks:
  popularPicks.map(
    (
      pick,
    ) => ({
      rank:
        pick.rank,

      key:
        pick.key,

      category:
        pick.category,

      market:
        pick.market,

      selection:
        pick.selection,

      probability:
        pick.probability,

      fairOdds:
        pick.fairOdds,

      reliabilityScore:
        pick.reliabilityScore,

      pickScore:
        pick.popularityScore,

      historicalHitRate:
        pick.historicalHitRate,

      historicalSamples:
        pick.historicalSamples,

      thresholdHitRate:
        pick.thresholdHitRate,

      thresholdSamples:
        pick.thresholdSamples,

      tier:
        pick.tier,

      reasons:
        pick.reasons,
    }),
  ),


        topPicks:
          topPicksResult
            .picks
            .map(
              (
                pick,
              ) => ({
                rank:
                  pick.rank,

                key:
                  pick.key,

                category:
                  pick.category,

                market:
                  pick.market,

                selection:
                  pick.selection,

                probability:
                  pick.probability,

                fairOdds:
                  pick.fairOdds,

                reliabilityScore:
                  pick
                    .reliabilityScore,

                pickScore:
                  pick
                    .pickScore,

                historicalHitRate:
                  pick.historicalHitRate,

                historicalSamples:
                  pick.historicalSamples,

                thresholdHitRate:
                  pick.thresholdHitRate,

                thresholdSamples:
                  pick.thresholdSamples,

                tier:
                  pick.tier,

                reasons:
                  pick.reasons,
              }),
            ),

        marketCount:
          marketModel
            .selections
            .length,

        homeRating:
          rating
            .home
            .overall,

        awayRating:
          rating
            .away
            .overall,

        homeAttack:
          rating
            .home
            .attack,

        awayAttack:
          rating
            .away
            .attack,

        homeDefense:
          rating
            .home
            .defense,

        awayDefense:
          rating
            .away
            .defense,

        homeForm:
          rating
            .home
            .form,

        awayForm:
          rating
            .away
            .form,

        homeFitness:
          rating
            .home
            .fitness,

        awayFitness:
          rating
            .away
            .fitness,

        ratingDifference:
          rating
            .ratingDifference,

        ratingEdge:
          rating
            .edge,

        warnings: [
  ...goalModel
    .warnings,

  ...predictionV2
    .warnings,

  ...marketModel
    .warnings,

  ...popularCandidateResult
    .warnings,

  ...topPicksResult
    .warnings,
].filter(
          (
            warning,
            index,
            warnings,
          ) =>
            warnings.indexOf(
              warning,
            ) ===
            index,
        ),
      };
    } catch (
      error: unknown
    ) {
      selectionAudits.push({
        matchId: match.id,
        kickoffAt: match.kickoffAt,
        evaluatedAt: auditGeneratedAt,
        decision: "ERROR",
        eligible: false,
        predictedOutcome: null,
        predictedProbability: null,
        homeProbability: null,
        drawProbability: null,
        awayProbability: null,
        expectedHomeGoals: null,
        expectedAwayGoals: null,
        advisoryMarket: null,
        advisorySelection: null,
        advisoryProbability: null,
        advisoryReliabilityScore: null,
        confidenceLevel: null,
        confidenceScore: null,
        dataQualityScore: null,
        productionModelName: null,
        summary:
          "The model evaluation could not be completed for this match.",
        failedCodes: [],
        checks: [],
      });

      console.error(
        [
          `Match ${match.id}`,
          `${match.homeTeam.name} - ${match.awayTeam.name}`,
          "dashboard prediction failed:",
        ].join(
          " ",
        ),

        error instanceof Error
          ? error.message
          : error,
      );

      return null;
    }
      },
    );

  try {
    await savePredictionSelectionAuditSnapshot(
      selectionAudits,
      auditGeneratedAt,
    );
  } catch (error: unknown) {
    console.error(
      "Selection audit snapshot could not be saved.",
      error instanceof Error
        ? error.message
        : error,
    );
  }

  const predictions =
    predictionResults.filter(
      (
        prediction,
      ): prediction is ProductionDashboardPrediction =>
        prediction !==
        null,
    );

  predictions.sort(
    (
      first,
      second,
    ) => {
      const candidateOrder =
        (
          first.productionCandidateType ===
          "PRIMARY_HOME"
            ? 0
            : 1
        ) -
        (
          second.productionCandidateType ===
          "PRIMARY_HOME"
            ? 0
            : 1
        );

      if (
        candidateOrder !==
        0
      ) {
        return candidateOrder;
      }

      const scoreOrder =
        second.productionScore -
        first.productionScore;

      if (
        scoreOrder !==
        0
      ) {
        return scoreOrder;
      }

      return (
        first.kickoffAt.getTime() -
        second.kickoffAt.getTime()
      );
    },
  );

  return predictions;
}

export async function loadDashboardPredictions(
  limit = 10,
): Promise<
  ProductionDashboardPrediction[]
> {
  if (
    !Number.isInteger(
      limit,
    ) ||
    limit <= 0
  ) {
    throw new Error(
      "limit must be a positive integer.",
    );
  }

  const now =
    Date.now();

  if (
    productionPredictionCache &&
    productionPredictionCache
      .expiresAt >
      now
  ) {
    return productionPredictionCache
      .predictions
      .slice(
        0,
        limit,
      );
  }

  if (
    !productionPredictionRequest
  ) {
    productionPredictionRequest =
      calculateDashboardPredictions()
        .then(
          (
            predictions,
          ) => {
            productionPredictionCache = {
              expiresAt:
                Date.now() +
                WEB_PREDICTION_CACHE_TTL_MS,

              predictions,
            };

            return predictions;
          },
        )
        .finally(
          () => {
            productionPredictionRequest =
              null;
          },
        );
  }

  const predictions =
    await productionPredictionRequest;

  return predictions.slice(
    0,
    limit,
  );
}
