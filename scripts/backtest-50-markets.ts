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

import type {
  MarketSelection,
} from "@/modules/market-engine";

const SEASON_YEAR =
  2024;

type Resolution =
  | "WIN"
  | "LOSS"
  | "VOID";

type MarketAccumulator = {
  key: string;

  category: string;

  market: string;

  selection: string;

  samples: number;
  wins: number;
  losses: number;
  voids: number;

  probabilityTotal: number;
  brierTotal: number;

  samples70: number;
  wins70: number;

  samples80: number;
  wins80: number;

  samples90: number;
  wins90: number;
};

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

function resolveMarket(
  selection:
    MarketSelection,

  homeGoals:
    number,

  awayGoals:
    number,
): Resolution {
  const totalGoals =
    homeGoals +
    awayGoals;

  switch (
    selection.key
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
        `Market resolution tanımlı değil: ${selection.key}`,
      );
  }
}

function createAccumulator(
  selection:
    MarketSelection,
): MarketAccumulator {
  return {
    key:
      selection.key,

    category:
      selection.category,

    market:
      selection.market,

    selection:
      selection.selection,

    samples:
      0,

    wins:
      0,

    losses:
      0,

    voids:
      0,

    probabilityTotal:
      0,

    brierTotal:
      0,

    samples70:
      0,

    wins70:
      0,

    samples80:
      0,

    wins80:
      0,

    samples90:
      0,

    wins90:
      0,
  };
}

function updateAccumulator(
  accumulator:
    MarketAccumulator,

  selection:
    MarketSelection,

  resolution:
    Resolution,
): void {
  if (
    resolution ===
    "VOID"
  ) {
    accumulator.voids +=
      1;

    return;
  }

  const probability =
    selection.probability;

  const probability01 =
    probability /
    100;

  const actual =
    resolution ===
    "WIN"
      ? 1
      : 0;

  accumulator.samples +=
    1;

  accumulator.probabilityTotal +=
    probability;

  accumulator.brierTotal +=
    (
      probability01 -
      actual
    ) **
    2;

  if (
    resolution ===
    "WIN"
  ) {
    accumulator.wins +=
      1;
  } else {
    accumulator.losses +=
      1;
  }

  if (
    probability >=
    70
  ) {
    accumulator.samples70 +=
      1;

    if (
      resolution ===
      "WIN"
    ) {
      accumulator.wins70 +=
        1;
    }
  }

  if (
    probability >=
    80
  ) {
    accumulator.samples80 +=
      1;

    if (
      resolution ===
      "WIN"
    ) {
      accumulator.wins80 +=
        1;
    }
  }

  if (
    probability >=
    90
  ) {
    accumulator.samples90 +=
      1;

    if (
      resolution ===
      "WIN"
    ) {
      accumulator.wins90 +=
        1;
    }
  }
}

function hitRate(
  wins:
    number,

  samples:
    number,
): number | null {
  if (
    samples ===
    0
  ) {
    return null;
  }

  return round(
    wins /
      samples *
      100,
    2,
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "50 MARKET HISTORICAL BACKTEST",
  );

  console.log(
    "========================================",
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

        homeScore:
          true,

        awayScore:
          true,

        kickoffAt:
          true,

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

  const accumulators =
    new Map<
      string,
      MarketAccumulator
    >();

  let processed =
    0;

  let failed =
    0;

  for (
    const match
    of matches
  ) {
    try {
      if (
        match.homeScore ===
          null ||
        match.awayScore ===
          null
      ) {
        continue;
      }

      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      const markets =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      for (
        const selection
        of markets.selections
      ) {
        let accumulator =
          accumulators.get(
            selection.key,
          );

        if (
          !accumulator
        ) {
          accumulator =
            createAccumulator(
              selection,
            );

          accumulators.set(
            selection.key,
            accumulator,
          );
        }

        const resolution =
          resolveMarket(
            selection,
            match.homeScore,
            match.awayScore,
          );

        updateAccumulator(
          accumulator,
          selection,
          resolution,
        );
      }

      processed +=
        1;

      if (
        processed %
          100 ===
        0
      ) {
        console.log(
          `[${processed}/${matches.length}] işlendi`,
        );
      }
    } catch (
      error
    ) {
      failed +=
        1;

      console.error(
        `Match ${match.id} failed:`,

        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  const results =
    [
      ...accumulators.values(),
    ].map(
      (
        accumulator,
      ) => {
        const averageProbability =
          accumulator.samples >
          0
            ? accumulator.probabilityTotal /
              accumulator.samples
            : 0;

        const historicalHitRate =
          hitRate(
            accumulator.wins,
            accumulator.samples,
          ) ??
          0;

        const calibrationGap =
          historicalHitRate -
          averageProbability;

        const brier =
          accumulator.samples >
          0
            ? accumulator.brierTotal /
              accumulator.samples
            : 0;

        return {
          key:
            accumulator.key,

          category:
            accumulator.category,

          market:
            accumulator.market,

          pick:
            accumulator.selection,

          samples:
            accumulator.samples,

          voids:
            accumulator.voids,

          avgProb:
            round(
              averageProbability,
              2,
            ),

          hitRate:
            round(
              historicalHitRate,
              2,
            ),

          calibrationGap:
            round(
              calibrationGap,
              2,
            ),

          brier:
            round(
              brier,
              4,
            ),

          samples70:
            accumulator.samples70,

          hit70:
            hitRate(
              accumulator.wins70,
              accumulator.samples70,
            ),

          samples80:
            accumulator.samples80,

          hit80:
            hitRate(
              accumulator.wins80,
              accumulator.samples80,
            ),

          samples90:
            accumulator.samples90,

          hit90:
            hitRate(
              accumulator.wins90,
              accumulator.samples90,
            ),
        };
      },
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "ALL MARKET RESULTS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results,
  );

  const strongMarkets =
    results
      .filter(
        (
          result,
        ) =>
          result.samples >=
            300 &&
          result.hitRate >=
            65 &&
          Math.abs(
            result.calibrationGap,
          ) <=
            5,
      )
      .sort(
        (
          first,
          second,
        ) =>
          second.hitRate -
          first.hitRate,
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "STRONG HISTORICAL MARKETS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    strongMarkets,
  );

  const newMarketKeys =
    new Set([
      "total_goals_over_5.5",
      "total_goals_under_5.5",
      "total_goals_odd",
      "total_goals_even",
      "btts_yes_over_2.5_yes",
      "btts_yes_over_2.5_no",
    ]);

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "NEW 6 MARKET RESULTS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results.filter(
      (
        result,
      ) =>
        newMarketKeys.has(
          result.key,
        ),
    ),
  );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "BACKTEST SUMMARY",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    matches:
      matches.length,

    processed,

    failed,

    markets:
      results.length,

    evaluations:
      results.reduce(
        (
          total,
          result,
        ) =>
          total +
          result.samples +
          result.voids,
        0,
      ),
  });
}

main()
  .catch(
    (
      error:
        unknown,
    ) => {
      console.error("");

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