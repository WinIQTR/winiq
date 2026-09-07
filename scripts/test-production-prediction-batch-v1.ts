import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

import {
  generateMatchPrediction,
} from "@/modules/prediction-engine";

import type {
  MatchPredictionResult,
} from "@/modules/prediction-engine";

type ConfidenceLevel =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "VERY_LOW";

type PredictionRow = {
  matchId: number;

  kickoffAt: Date;

  leagueApiId: number;
  leagueName: string;

  homeTeam: string;
  awayTeam: string;

  predictedOutcome:
    "HOME"
    | "DRAW"
    | "AWAY";

  predictedProbability:
    number;

  homeProbability:
    number;

  drawProbability:
    number;

  awayProbability:
    number;

  homeExpectedGoals:
    number | null;

  awayExpectedGoals:
    number | null;

  confidenceScore:
    number;

  confidenceLevel:
    ConfidenceLevel;

  dataQualityScore:
    number;

  probabilityGap:
    number;

  leagueMatches:
    number;

  homeVenueMatches:
    number;

  awayVenueMatches:
    number;

  drawOverride:
    boolean;

  drawGap:
    number;

  fairOdds:
    number;

  warningCount:
    number;

  productionScore:
    number;
};

type LeagueSummary = {
  leagueApiId: number;

  leagueName: string;

  matches: number;

  veryHigh: number;
  high: number;
  medium: number;
  low: number;
  veryLow: number;

  homePredictions: number;
  drawPredictions: number;
  awayPredictions: number;

  drawOverrides: number;

  averageProbability: number;

  averageConfidence: number;

  averageDataQuality: number;

  averageHomeVenueMatches: number;

  averageAwayVenueMatches: number;
};

const DEFAULT_BATCH_LIMIT =
  300;

const MAXIMUM_BATCH_LIMIT =
  500;

const DEFAULT_DAYS_AHEAD =
  60;

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

function getBatchLimit():
  number {
  const rawValue =
    process.env
      .PREDICTION_BATCH_LIMIT
      ?.trim();

  if (
    !rawValue
  ) {
    return DEFAULT_BATCH_LIMIT;
  }

  const parsedValue =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <=
      0 ||
    parsedValue >
      MAXIMUM_BATCH_LIMIT
  ) {
    return DEFAULT_BATCH_LIMIT;
  }

  return parsedValue;
}

function getDaysAhead():
  number {
  const rawValue =
    process.env
      .PREDICTION_BATCH_DAYS
      ?.trim();

  if (
    !rawValue
  ) {
    return DEFAULT_DAYS_AHEAD;
  }

  const parsedValue =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue <=
      0 ||
    parsedValue >
      180
  ) {
    return DEFAULT_DAYS_AHEAD;
  }

  return parsedValue;
}

function addDays(
  date: Date,
  days: number,
): Date {
  const result =
    new Date(
      date,
    );

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

function confidenceRank(
  level:
    ConfidenceLevel,
): number {
  switch (
    level
  ) {
    case "VERY_HIGH":
      return 5;

    case "HIGH":
      return 4;

    case "MEDIUM":
      return 3;

    case "LOW":
      return 2;

    case "VERY_LOW":
      return 1;
  }
}

function getFairOdds(
  prediction:
    MatchPredictionResult,
): number {
  switch (
    prediction
      .predictedOutcome
  ) {
    case "HOME":
      return (
        prediction
          .finalFairOdds
          .home
      );

    case "DRAW":
      return (
        prediction
          .finalFairOdds
          .draw
      );

    case "AWAY":
      return (
        prediction
          .finalFairOdds
          .away
      );
  }
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

    drawOverride:
      boolean;
  },
): number {
  /*
   * Bu bir yeni tahmin modeli DEĞİLDİR.
   *
   * Sadece batch sonuçlarını kullanıcıya
   * faydalı biçimde sıralamak için
   * kullanılan görüntüleme / ranking
   * puanıdır.
   *
   * Tahmin olasılıklarını değiştirmez.
   */
  const probabilityComponent =
    options.probability *
    0.35;

  const confidenceComponent =
    options.confidence *
    0.35;

  const dataQualityComponent =
    options.dataQuality *
    0.2;

  /*
   * 30 puanlık 1X2 ayrışma
   * bu bileşende maksimum kabul edilir.
   */
  const normalizedGap =
    Math.min(
      (
        options.probabilityGap /
        30
      ) *
        100,
      100,
    );

  const gapComponent =
    normalizedGap *
    0.1;

  /*
   * DRAW Decision Layer historical
   * holdout'ta PASS aldı.
   *
   * Ancak argmax override ettiği için
   * ranking açısından küçük bir
   * ihtiyat katsayısı uyguluyoruz.
   */
  const drawOverridePenalty =
    options.drawOverride
      ? 3
      : 0;

  return round(
    probabilityComponent +
      confidenceComponent +
      dataQualityComponent +
      gapComponent -
      drawOverridePenalty,
  );
}

function createPredictionRow(
  options: {
    matchId:
      number;

    kickoffAt:
      Date;

    leagueApiId:
      number;

    leagueName:
      string;

    homeTeam:
      string;

    awayTeam:
      string;

    prediction:
      MatchPredictionResult;
  },
): PredictionRow {
  const confidence =
    options
      .prediction
      .poissonConfidence;

  const productionScore =
    calculateProductionScore({
      probability:
        options
          .prediction
          .predictedProbability,

      confidence:
        confidence.score,

      dataQuality:
        confidence
          .dataQualityScore,

      probabilityGap:
        confidence
          .probabilityGap,

      drawOverride:
        options
          .prediction
          .drawDecision
          .applied,
    });

  return {
    matchId:
      options.matchId,

    kickoffAt:
      options.kickoffAt,

    leagueApiId:
      options.leagueApiId,

    leagueName:
      options.leagueName,

    homeTeam:
      options.homeTeam,

    awayTeam:
      options.awayTeam,

    predictedOutcome:
      options
        .prediction
        .predictedOutcome,

    predictedProbability:
      options
        .prediction
        .predictedProbability,

    homeProbability:
      options
        .prediction
        .finalProbabilities
        .home,

    drawProbability:
      options
        .prediction
        .finalProbabilities
        .draw,

    awayProbability:
      options
        .prediction
        .finalProbabilities
        .away,

    /*
     * MatchPredictionResult şu anda
     * expectedGoals alanını doğrudan
     * taşımıyor.
     *
     * Batch V1'de null bırakıyoruz.
     * Dashboard aşamasında goal model
     * özetini result'a ekleyebiliriz.
     */
    homeExpectedGoals:
      null,

    awayExpectedGoals:
      null,

    confidenceScore:
      confidence.score,

    confidenceLevel:
      confidence.level,

    dataQualityScore:
      confidence
        .dataQualityScore,

    probabilityGap:
      confidence
        .probabilityGap,

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

    drawOverride:
      options
        .prediction
        .drawDecision
        .applied,

    drawGap:
      options
        .prediction
        .drawDecision
        .drawGap,

    fairOdds:
      getFairOdds(
        options.prediction,
      ),

    warningCount:
      options
        .prediction
        .warnings
        .length,

    productionScore,
  };
}

function buildLeagueSummaries(
  rows:
    PredictionRow[],
): LeagueSummary[] {
  const leagueGroups =
    new Map<
      number,
      PredictionRow[]
    >();

  for (
    const row
    of rows
  ) {
    const existing =
      leagueGroups.get(
        row.leagueApiId,
      );

    if (
      existing
    ) {
      existing.push(
        row,
      );
    } else {
      leagueGroups.set(
        row.leagueApiId,
        [
          row,
        ],
      );
    }
  }

  const summaries:
    LeagueSummary[] =
      [];

  for (
    const [
      leagueApiId,
      leagueRows,
    ]
    of leagueGroups.entries()
  ) {
    const first =
      leagueRows[
        0
      ];

    const matches =
      leagueRows.length;

    const totalProbability =
      leagueRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.predictedProbability,
        0,
      );

    const totalConfidence =
      leagueRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.confidenceScore,
        0,
      );

    const totalDataQuality =
      leagueRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.dataQualityScore,
        0,
      );

    const totalHomeVenue =
      leagueRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.homeVenueMatches,
        0,
      );

    const totalAwayVenue =
      leagueRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.awayVenueMatches,
        0,
      );

    summaries.push({
      leagueApiId,

      leagueName:
        first.leagueName,

      matches,

      veryHigh:
        leagueRows.filter(
          (
            row,
          ) =>
            row.confidenceLevel ===
            "VERY_HIGH",
        ).length,

      high:
        leagueRows.filter(
          (
            row,
          ) =>
            row.confidenceLevel ===
            "HIGH",
        ).length,

      medium:
        leagueRows.filter(
          (
            row,
          ) =>
            row.confidenceLevel ===
            "MEDIUM",
        ).length,

      low:
        leagueRows.filter(
          (
            row,
          ) =>
            row.confidenceLevel ===
            "LOW",
        ).length,

      veryLow:
        leagueRows.filter(
          (
            row,
          ) =>
            row.confidenceLevel ===
            "VERY_LOW",
        ).length,

      homePredictions:
        leagueRows.filter(
          (
            row,
          ) =>
            row.predictedOutcome ===
            "HOME",
        ).length,

      drawPredictions:
        leagueRows.filter(
          (
            row,
          ) =>
            row.predictedOutcome ===
            "DRAW",
        ).length,

      awayPredictions:
        leagueRows.filter(
          (
            row,
          ) =>
            row.predictedOutcome ===
            "AWAY",
        ).length,

      drawOverrides:
        leagueRows.filter(
          (
            row,
          ) =>
            row.drawOverride,
        ).length,

      averageProbability:
        round(
          totalProbability /
          matches,
        ),

      averageConfidence:
        round(
          totalConfidence /
          matches,
        ),

      averageDataQuality:
        round(
          totalDataQuality /
          matches,
        ),

      averageHomeVenueMatches:
        round(
          totalHomeVenue /
          matches,
        ),

      averageAwayVenueMatches:
        round(
          totalAwayVenue /
          matches,
        ),
    });
  }

  return summaries.sort(
    (
      first,
      second,
    ) =>
      second.averageConfidence -
      first.averageConfidence,
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION PREDICTION BATCH V1",
  );

  console.log(
    "==============================================",
  );

  const batchLimit =
    getBatchLimit();

  const daysAhead =
    getDaysAhead();

  const now =
    new Date();

  const endDate =
    addDays(
      now,
      daysAhead,
    );

  const matches =
    await prisma
      .match
      .findMany({
        where: {
          status:
            "SCHEDULED",

          kickoffAt: {
            gte:
              now,

            lte:
              endDate,
          },

          season: {
            year:
              ACTIVE_SEASON_YEAR,

            league: {
              apiId: {
                in: [
                  ...ACTIVE_COMPETITION_API_IDS,
                ],
              },
            },
          },
        },

        orderBy: [
          {
            kickoffAt:
              "asc",
          },

          {
            id:
              "asc",
          },
        ],

        take:
          batchLimit,

        select: {
          id:
            true,

          apiId:
            true,

          kickoffAt:
            true,

          status:
            true,

          homeTeam: {
            select: {
              name:
                true,
            },
          },

          awayTeam: {
            select: {
              name:
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
      });

  console.table({
    Sezon:
      ACTIVE_SEASON_YEAR,

    "Gün aralığı":
      daysAhead,

    "Batch limit":
      batchLimit,

    "Bulunan maç":
      matches.length,

    Başlangıç:
      now
        .toISOString(),

    Bitiş:
      endDate
        .toISOString(),
  });

  if (
    matches.length ===
    0
  ) {
    console.log("");
    console.log(
      "Yaklaşan SCHEDULED maç bulunamadı.",
    );

    return;
  }

  const resultRows:
    PredictionRow[] =
      [];

  const failedRows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  let processed =
    0;

  let failed =
    0;

  for (
    let index =
      0;

    index <
    matches.length;

    index +=
      1
  ) {
    const match =
      matches[
        index
      ];

    console.log("");
    console.log(
      [
        `[${index + 1}/${matches.length}]`,
        `[${match.season.league.name}]`,
        `${match.homeTeam.name} - ${match.awayTeam.name}`,
      ].join(
        " ",
      ),
    );

    try {
      const prediction =
        await generateMatchPrediction({
          matchId:
            match.id,
        });

      const row =
        createPredictionRow({
          matchId:
            match.id,

          kickoffAt:
            match.kickoffAt,

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

          prediction,
        });

      resultRows.push(
        row,
      );

      processed +=
        1;

      console.log(
        [
          `Tahmin=${row.predictedOutcome}`,
          `%${row.predictedProbability}`,
          `Confidence=${row.confidenceScore}`,
          row.confidenceLevel,
          `Data=${row.dataQualityScore}`,
          row.drawOverride
            ? "DRAW_OVERRIDE"
            : "BASELINE",
        ].join(
          " • ",
        ),
      );
    } catch (
      error: unknown
    ) {
      failed +=
        1;

      const errorMessage =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      failedRows.push({
        matchId:
          match.id,

        fixtureApiId:
          match.apiId,

        league:
          match
            .season
            .league
            .name,

        match:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        kickoff:
          match
            .kickoffAt
            .toISOString(),

        error:
          errorMessage,
      });

      console.error(
        `FAILED: ${errorMessage}`,
      );
    }
  }

  /*
   * ==================================================
   * OVERALL SUMMARY
   * ==================================================
   */

  const veryHigh =
    resultRows.filter(
      (
        row,
      ) =>
        row.confidenceLevel ===
        "VERY_HIGH",
    ).length;

  const high =
    resultRows.filter(
      (
        row,
      ) =>
        row.confidenceLevel ===
        "HIGH",
    ).length;

  const medium =
    resultRows.filter(
      (
        row,
      ) =>
        row.confidenceLevel ===
        "MEDIUM",
    ).length;

  const low =
    resultRows.filter(
      (
        row,
      ) =>
        row.confidenceLevel ===
        "LOW",
    ).length;

  const veryLow =
    resultRows.filter(
      (
        row,
      ) =>
        row.confidenceLevel ===
        "VERY_LOW",
    ).length;

  const homePredictions =
    resultRows.filter(
      (
        row,
      ) =>
        row.predictedOutcome ===
        "HOME",
    ).length;

  const drawPredictions =
    resultRows.filter(
      (
        row,
      ) =>
        row.predictedOutcome ===
        "DRAW",
    ).length;

  const awayPredictions =
    resultRows.filter(
      (
        row,
      ) =>
        row.predictedOutcome ===
        "AWAY",
    ).length;

  const drawOverrides =
    resultRows.filter(
      (
        row,
      ) =>
        row.drawOverride,
    ).length;

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "BATCH SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Bulunan maç":
      matches.length,

    İşlenen:
      processed,

    Başarısız:
      failed,

    VERY_HIGH:
      veryHigh,

    HIGH:
      high,

    MEDIUM:
      medium,

    LOW:
      low,

    VERY_LOW:
      veryLow,

    HOME:
      homePredictions,

    DRAW:
      drawPredictions,

    AWAY:
      awayPredictions,

    "DRAW Override":
      drawOverrides,
  });

  /*
   * ==================================================
   * CONFIDENCE DISTRIBUTION
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CONFIDENCE DISTRIBUTION",
  );

  console.log(
    "==============================================",
  );

  console.table([
    {
      level:
        "VERY_HIGH",

      matches:
        veryHigh,

      ratio:
        resultRows.length >
        0
          ? `${round(
              (
                veryHigh /
                resultRows.length
              ) *
                100,
            )}%`
          : "0%",
    },

    {
      level:
        "HIGH",

      matches:
        high,

      ratio:
        resultRows.length >
        0
          ? `${round(
              (
                high /
                resultRows.length
              ) *
                100,
            )}%`
          : "0%",
    },

    {
      level:
        "MEDIUM",

      matches:
        medium,

      ratio:
        resultRows.length >
        0
          ? `${round(
              (
                medium /
                resultRows.length
              ) *
                100,
            )}%`
          : "0%",
    },

    {
      level:
        "LOW",

      matches:
        low,

      ratio:
        resultRows.length >
        0
          ? `${round(
              (
                low /
                resultRows.length
              ) *
                100,
            )}%`
          : "0%",
    },

    {
      level:
        "VERY_LOW",

      matches:
        veryLow,

      ratio:
        resultRows.length >
        0
          ? `${round(
              (
                veryLow /
                resultRows.length
              ) *
                100,
            )}%`
          : "0%",
    },
  ]);

  /*
   * ==================================================
   * LEAGUE QUALITY
   * ==================================================
   */

  const leagueSummaries =
    buildLeagueSummaries(
      resultRows,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEAGUE QUALITY SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table(
    leagueSummaries.map(
      (
        league,
      ) => ({
        apiId:
          league.leagueApiId,

        league:
          league.leagueName,

        matches:
          league.matches,

        veryHigh:
          league.veryHigh,

        high:
          league.high,

        medium:
          league.medium,

        low:
          league.low,

        veryLow:
          league.veryLow,

        avgProbability:
          league.averageProbability,

        avgConfidence:
          league.averageConfidence,

        avgDataQuality:
          league.averageDataQuality,

        avgHomeVenue:
          league
            .averageHomeVenueMatches,

        avgAwayVenue:
          league
            .averageAwayVenueMatches,

        drawOverrides:
          league.drawOverrides,
      }),
    ),
  );

  /*
   * ==================================================
   * STRONGEST PREDICTIONS
   * ==================================================
   */

  const strongest =
    [
      ...resultRows,
    ].sort(
      (
        first,
        second,
      ) => {
        const confidenceDifference =
          confidenceRank(
            second.confidenceLevel,
          ) -
          confidenceRank(
            first.confidenceLevel,
          );

        if (
          confidenceDifference !==
          0
        ) {
          return confidenceDifference;
        }

        return (
          second.productionScore -
          first.productionScore
        );
      },
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TOP 30 PRODUCTION PREDICTIONS",
  );

  console.log(
    "==============================================",
  );

  console.table(
    strongest
      .slice(
        0,
        30,
      )
      .map(
        (
          row,
          index,
        ) => ({
          rank:
            index +
            1,

          matchId:
            row.matchId,

          date:
            row
              .kickoffAt
              .toISOString()
              .slice(
                0,
                16,
              ),

          league:
            row.leagueName,

          match:
            `${row.homeTeam} - ${row.awayTeam}`,

          prediction:
            row.predictedOutcome,

          probability:
            `${row.predictedProbability}%`,

          confidence:
            row.confidenceScore,

          level:
            row.confidenceLevel,

          dataQuality:
            row.dataQualityScore,

          gap:
            row.probabilityGap,

          fairOdds:
            row.fairOdds,

          homeVenue:
            row.homeVenueMatches,

          awayVenue:
            row.awayVenueMatches,

          drawOverride:
            row.drawOverride
              ? "YES"
              : "NO",

          score:
            row.productionScore,
        }),
      ),
  );

  /*
   * ==================================================
   * HIGH QUALITY ONLY
   * ==================================================
   */

  const publishable =
    strongest.filter(
      (
        row,
      ) =>
        (
          row.confidenceLevel ===
            "HIGH" ||
          row.confidenceLevel ===
            "VERY_HIGH"
        ) &&
        row.dataQualityScore >=
          65 &&
        row.predictedProbability >=
          45,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "HIGH QUALITY / PUBLISHABLE CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  if (
    publishable.length ===
    0
  ) {
    console.log(
      "HIGH / VERY_HIGH production adayı bulunamadı.",
    );
  } else {
    console.table(
      publishable.map(
        (
          row,
          index,
        ) => ({
          rank:
            index +
            1,

          matchId:
            row.matchId,

          league:
            row.leagueName,

          match:
            `${row.homeTeam} - ${row.awayTeam}`,

          prediction:
            row.predictedOutcome,

          probability:
            row.predictedProbability,

          confidence:
            row.confidenceScore,

          level:
            row.confidenceLevel,

          dataQuality:
            row.dataQualityScore,

          fairOdds:
            row.fairOdds,

          drawOverride:
            row.drawOverride
              ? "YES"
              : "NO",
        }),
      ),
    );
  }

  /*
   * ==================================================
   * DRAW CANDIDATES
   * ==================================================
   */

  const drawRows =
    resultRows
      .filter(
        (
          row,
        ) =>
          row.predictedOutcome ===
          "DRAW",
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.productionScore -
          first.productionScore,
      );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW PREDICTIONS",
  );

  console.log(
    "==============================================",
  );

  if (
    drawRows.length ===
    0
  ) {
    console.log(
      "Yaklaşan maçlarda DRAW tahmini bulunamadı.",
    );
  } else {
    console.table(
      drawRows.map(
        (
          row,
          index,
        ) => ({
          rank:
            index +
            1,

          matchId:
            row.matchId,

          league:
            row.leagueName,

          match:
            `${row.homeTeam} - ${row.awayTeam}`,

          drawProbability:
            row.drawProbability,

          confidence:
            row.confidenceScore,

          level:
            row.confidenceLevel,

          dataQuality:
            row.dataQualityScore,

          drawGap:
            row.drawGap,

          override:
            row.drawOverride
              ? "YES"
              : "NO",

          fairOdds:
            row.fairOdds,
        }),
      ),
    );
  }

  /*
   * ==================================================
   * LOW DATA QUALITY
   * ==================================================
   */

  const lowDataQuality =
    resultRows
      .filter(
        (
          row,
        ) =>
          row.dataQualityScore <
          50,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.dataQualityScore -
          second.dataQualityScore,
      );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LOW DATA QUALITY MATCHES",
  );

  console.log(
    "==============================================",
  );

  console.log(
    `Toplam düşük veri kaliteli maç: ${lowDataQuality.length}`,
  );

  if (
    lowDataQuality.length >
    0
  ) {
    console.table(
      lowDataQuality
        .slice(
          0,
          30,
        )
        .map(
          (
            row,
          ) => ({
            matchId:
              row.matchId,

            league:
              row.leagueName,

            match:
              `${row.homeTeam} - ${row.awayTeam}`,

            prediction:
              row.predictedOutcome,

            probability:
              row.predictedProbability,

            confidence:
              row.confidenceScore,

            dataQuality:
              row.dataQualityScore,

            leagueMatches:
              row.leagueMatches,

            homeVenue:
              row.homeVenueMatches,

            awayVenue:
              row.awayVenueMatches,
          }),
        ),
    );
  }

  /*
   * ==================================================
   * FAILURES
   * ==================================================
   */

  if (
    failedRows.length >
    0
  ) {
    console.log("");
    console.log(
      "==============================================",
    );

    console.log(
      "FAILED MATCHES",
    );

    console.log(
      "==============================================",
    );

    console.table(
      failedRows,
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION PREDICTION BATCH V1 TAMAMLANDI.",
  );

  console.log(
    "==============================================",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");
      console.error(
        "Production Prediction Batch V1 başarısız.",
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );