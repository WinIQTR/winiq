import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

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
  rankTopPicks,
} from "@/modules/top-picks-engine";

import type {
  RankedMarketPick,
} from "@/modules/top-picks-engine";

const SEASON_YEAR =
  2024;

const TOP_PICKS_LIMIT =
  10;

type PickResult =
  | "WIN"
  | "LOSS"
  | "VOID";

function resolvePick(
  pick:
    RankedMarketPick,

  homeGoals:
    number,

  awayGoals:
    number,
): PickResult {
  const totalGoals =
    homeGoals +
    awayGoals;

  switch (
    pick.key
  ) {
    /*
     * ========================================================
     * MATCH RESULT
     * ========================================================
     */

    case "match_result_home":
      return homeGoals >
        awayGoals
        ? "WIN"
        : "LOSS";

    case "match_result_draw":
      return homeGoals ===
        awayGoals
        ? "WIN"
        : "LOSS";

    case "match_result_away":
      return awayGoals >
        homeGoals
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * DOUBLE CHANCE
     * ========================================================
     */

    case "double_chance_1x":
      return homeGoals >=
        awayGoals
        ? "WIN"
        : "LOSS";

    case "double_chance_x2":
      return awayGoals >=
        homeGoals
        ? "WIN"
        : "LOSS";

    case "double_chance_12":
      return homeGoals !==
        awayGoals
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * DRAW NO BET
     * ========================================================
     */

    case "dnb_home":
      if (
        homeGoals ===
        awayGoals
      ) {
        return "VOID";
      }

      return homeGoals >
        awayGoals
        ? "WIN"
        : "LOSS";

    case "dnb_away":
      if (
        homeGoals ===
        awayGoals
      ) {
        return "VOID";
      }

      return awayGoals >
        homeGoals
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * TOTAL GOALS
     * ========================================================
     */

    case "total_goals_over_0.5":
      return totalGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_0.5":
      return totalGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_1.5":
      return totalGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_1.5":
      return totalGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_2.5":
      return totalGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_2.5":
      return totalGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_3.5":
      return totalGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_3.5":
      return totalGoals <
        3.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_4.5":
      return totalGoals >
        4.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_4.5":
      return totalGoals <
        4.5
        ? "WIN"
        : "LOSS";

    case "total_goals_over_5.5":
      return totalGoals >
        5.5
        ? "WIN"
        : "LOSS";

    case "total_goals_under_5.5":
      return totalGoals <
        5.5
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * HOME TEAM GOALS
     * ========================================================
     */

    case "home_team_goals_over_0.5":
      return homeGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_0.5":
      return homeGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_1.5":
      return homeGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_1.5":
      return homeGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_2.5":
      return homeGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_2.5":
      return homeGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_over_3.5":
      return homeGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "home_team_goals_under_3.5":
      return homeGoals <
        3.5
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * AWAY TEAM GOALS
     * ========================================================
     */

    case "away_team_goals_over_0.5":
      return awayGoals >
        0.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_0.5":
      return awayGoals <
        0.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_1.5":
      return awayGoals >
        1.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_1.5":
      return awayGoals <
        1.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_2.5":
      return awayGoals >
        2.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_2.5":
      return awayGoals <
        2.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_over_3.5":
      return awayGoals >
        3.5
        ? "WIN"
        : "LOSS";

    case "away_team_goals_under_3.5":
      return awayGoals <
        3.5
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * BTTS
     * ========================================================
     */

    case "btts_yes":
      return (
        homeGoals >
          0 &&
        awayGoals >
          0
      )
        ? "WIN"
        : "LOSS";

    case "btts_no":
      return (
        homeGoals ===
          0 ||
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * CLEAN SHEET
     * ========================================================
     */

    case "home_clean_sheet_yes":
      return awayGoals ===
        0
        ? "WIN"
        : "LOSS";

    case "home_clean_sheet_no":
      return awayGoals >
        0
        ? "WIN"
        : "LOSS";

    case "away_clean_sheet_yes":
      return homeGoals ===
        0
        ? "WIN"
        : "LOSS";

    case "away_clean_sheet_no":
      return homeGoals >
        0
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * WIN TO NIL
     * ========================================================
     */

    case "home_win_to_nil_yes":
      return (
        homeGoals >
          awayGoals &&
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "home_win_to_nil_no":
      return !(
        homeGoals >
          awayGoals &&
        awayGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "away_win_to_nil_yes":
      return (
        awayGoals >
          homeGoals &&
        homeGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    case "away_win_to_nil_no":
      return !(
        awayGoals >
          homeGoals &&
        homeGoals ===
          0
      )
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * ODD / EVEN
     * ========================================================
     */

    case "total_goals_odd":
      return totalGoals %
          2 ===
        1
        ? "WIN"
        : "LOSS";

    case "total_goals_even":
      return totalGoals %
          2 ===
        0
        ? "WIN"
        : "LOSS";

    /*
     * ========================================================
     * BTTS + OVER 2.5
     * ========================================================
     */

    case "btts_yes_over_2.5_yes": {
      const happened =
        homeGoals >
          0 &&
        awayGoals >
          0 &&
        totalGoals >
          2.5;

      return happened
        ? "WIN"
        : "LOSS";
    }

    case "btts_yes_over_2.5_no": {
      const happened =
        homeGoals >
          0 &&
        awayGoals >
          0 &&
        totalGoals >
          2.5;

      return happened
        ? "LOSS"
        : "WIN";
    }

    default:
      throw new Error(
        `Smart Pick result tanımlı değil: ${pick.key}`,
      );
  }
}

async function main(): Promise<void> {
  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "SMART PICK HISTORY GENERATOR",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Sezon: ${SEASON_YEAR}`,
  );

  console.log(
    `Top Picks / maç: maksimum ${TOP_PICKS_LIMIT}`,
  );

  const leagueApiIds =
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) =>
        competition.apiId,
    );

  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "FINISHED",

        homeScore: {
          not:
            null,
        },

        awayScore: {
          not:
            null,
        },

        season: {
          year:
            SEASON_YEAR,

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

        homeScore:
          true,

        awayScore:
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
    });

  console.log("");

  console.log(
    `Historical maç: ${matches.length}`,
  );

  console.log("");

  let processedMatches =
    0;

  let failedMatches =
    0;

  let generatedPicks =
    0;

  let wins =
    0;

  let losses =
    0;

  let voids =
    0;

  for (
    let index = 0;
    index < matches.length;
    index += 1
  ) {
    const match =
      matches[index];

    try {
      if (
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      ) {
        continue;
      }

      /*
       * ======================================================
       * GOAL MODEL
       * ======================================================
       */

      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      /*
       * ======================================================
       * 50 MARKET
       * ======================================================
       */

      const marketModel =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      /*
       * ======================================================
       * TOP PICKS
       * ======================================================
       */

      const topPicks =
        rankTopPicks(
          marketModel,
          {
            limit:
              TOP_PICKS_LIMIT,

            minimumProbability:
              60,

            minimumHistoricalSamples:
              300,

            minimumFairOdds:
              1.05,

            maximumFairOdds:
              5,

            maximumSelectionsPerMarket:
              1,

            maximumSelectionsPerFamily:
              2,
          },
        );

      /*
       * ======================================================
       * SAVE PICKS
       * ======================================================
       */

      for (
        const pick
        of topPicks.picks
      ) {
        const result =
          resolvePick(
            pick,
            match.homeScore,
            match.awayScore,
          );

        if (
          result ===
          "WIN"
        ) {
          wins +=
            1;
        } else if (
          result ===
          "LOSS"
        ) {
          losses +=
            1;
        } else {
          voids +=
            1;
        }

        await prisma.smartPickHistory.upsert({
          where: {
            match_market_model_unique: {
              matchId:
                match.id,

              marketKey:
                pick.key,

              modelVersion:
                topPicks
                  .model
                  .version,
            },
          },

          update: {
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

            kickoffAt:
              match.kickoffAt,

            homeTeam:
              match
                .homeTeam
                .name,

            awayTeam:
              match
                .awayTeam
                .name,

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
              pick.pickScore,

            tier:
              pick.tier,

            historicalHitRate:
              pick.historicalHitRate,

            historicalSamples:
              pick.historicalSamples,

            thresholdHitRate:
              pick.thresholdHitRate,

            thresholdSamples:
              pick.thresholdSamples,

            actualHomeScore:
              match.homeScore,

            actualAwayScore:
              match.awayScore,

            result,

            rank:
              pick.rank,

            modelName:
              topPicks
                .model
                .name,
          },

          create: {
            matchId:
              match.id,

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

            kickoffAt:
              match.kickoffAt,

            homeTeam:
              match
                .homeTeam
                .name,

            awayTeam:
              match
                .awayTeam
                .name,

            marketKey:
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
              pick.pickScore,

            tier:
              pick.tier,

            historicalHitRate:
              pick.historicalHitRate,

            historicalSamples:
              pick.historicalSamples,

            thresholdHitRate:
              pick.thresholdHitRate,

            thresholdSamples:
              pick.thresholdSamples,

            actualHomeScore:
              match.homeScore,

            actualAwayScore:
              match.awayScore,

            result,

            rank:
              pick.rank,

            modelName:
              topPicks
                .model
                .name,

            modelVersion:
              topPicks
                .model
                .version,
          },
        });

        generatedPicks +=
          1;
      }

      processedMatches +=
        1;

      if (
        (
          index +
          1
        ) %
          100 ===
        0
      ) {
        console.log(
          [
            `[${index + 1}/${matches.length}]`,
            `maç ${processedMatches}`,
            `pick ${generatedPicks}`,
            `WIN ${wins}`,
            `LOSS ${losses}`,
            `VOID ${voids}`,
          ].join(
            " • ",
          ),
        );
      }
    } catch (
      error
    ) {
      failedMatches +=
        1;

      console.error(
        `Match ${match.id} failed:`,

        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  /*
   * =========================================================
   * DATABASE SUMMARY
   * =========================================================
   */

  const databaseRows =
    await prisma.smartPickHistory.count();

  const databaseWins =
    await prisma.smartPickHistory.count({
      where: {
        result:
          "WIN",
      },
    });

  const databaseLosses =
    await prisma.smartPickHistory.count({
      where: {
        result:
          "LOSS",
      },
    });

  const databaseVoids =
    await prisma.smartPickHistory.count({
      where: {
        result:
          "VOID",
      },
    });

  const settled =
    databaseWins +
    databaseLosses;

  const hitRate =
    settled >
    0
      ? (
          databaseWins /
          settled
        ) *
        100
      : 0;

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "SMART PICK HISTORY RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "Historical maç":
      matches.length,

    "İşlenen maç":
      processedMatches,

    "Hatalı maç":
      failedMatches,

    "Üretilen pick":
      generatedPicks,

    "Database row":
      databaseRows,

    WIN:
      databaseWins,

    LOSS:
      databaseLosses,

    VOID:
      databaseVoids,

    "Settled pick":
      settled,

    "Hit Rate":
      `${hitRate.toFixed(2)}%`,
  });

  /*
   * =========================================================
   * TIER PERFORMANCE
   * =========================================================
   */

  const tierRows =
    await prisma.smartPickHistory.groupBy({
      by: [
        "tier",
        "result",
      ],

      _count: {
        _all:
          true,
      },
    });

  const tierMap =
    new Map<
      string,
      {
        wins: number;
        losses: number;
        voids: number;
      }
    >();

  for (
    const row
    of tierRows
  ) {
    const current =
      tierMap.get(
        row.tier,
      ) ?? {
        wins:
          0,

        losses:
          0,

        voids:
          0,
      };

    if (
      row.result ===
      "WIN"
    ) {
      current.wins =
        row._count._all;
    }

    if (
      row.result ===
      "LOSS"
    ) {
      current.losses =
        row._count._all;
    }

    if (
      row.result ===
      "VOID"
    ) {
      current.voids =
        row._count._all;
    }

    tierMap.set(
      row.tier,
      current,
    );
  }

  console.log("");

  console.log(
    "TIER PERFORMANCE",
  );

  console.log("");

  console.table(
    [
      ...tierMap.entries(),
    ].map(
      (
        [
          tier,
          values,
        ],
      ) => {
        const tierSettled =
          values.wins +
          values.losses;

        return {
          tier,

          picks:
            tierSettled +
            values.voids,

          wins:
            values.wins,

          losses:
            values.losses,

          voids:
            values.voids,

          hitRate:
            tierSettled >
            0
              ? `${(
                  (
                    values.wins /
                    tierSettled
                  ) *
                  100
                ).toFixed(
                  2,
                )}%`
              : null,
        };
      },
    ),
  );

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "GENERATOR COMPLETE",
  );

  console.log(
    "========================================",
  );
}

main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error("");

      console.error(
        "Smart Pick History üretilemedi.",
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