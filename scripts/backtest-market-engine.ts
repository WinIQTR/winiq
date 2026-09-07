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

type SelectionResult =
  | "WIN"
  | "LOSS"
  | "PUSH";

type MarketAggregate = {
  key: string;
  category: string;
  market: string;
  selection: string;

  predictions: number;

  wins: number;
  losses: number;
  pushes: number;

  probabilityTotal: number;

  brierTotal: number;

  highConfidence60Predictions: number;
  highConfidence60Wins: number;

  highConfidence70Predictions: number;
  highConfidence70Wins: number;

  highConfidence80Predictions: number;
  highConfidence80Wins: number;

  highConfidence90Predictions: number;
  highConfidence90Wins: number;
};

const SEASON_YEAR =
  2024;

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

function percentage(
  numerator: number,
  denominator: number,
): number | null {
  if (
    denominator <=
    0
  ) {
    return null;
  }

  return round(
    (
      numerator /
      denominator
    ) *
      100,
    2,
  );
}

function parseLineFromKey(
  key: string,
): number | null {
  const match =
    key.match(
      /_(\d+(?:\.\d+)?)$/,
    );

  if (
    !match
  ) {
    return null;
  }

  const value =
    Number(
      match[1],
    );

  if (
    !Number.isFinite(
      value,
    )
  ) {
    return null;
  }

  return value;
}

function evaluateSelection(
  options: {
    selection:
      MarketSelection;

    homeScore:
      number;

    awayScore:
      number;
  },
): SelectionResult {
  const {
    selection,
    homeScore,
    awayScore,
  } = options;

  const key =
    selection.key;

  /*
   * ============================================================
   * MATCH RESULT
   * ============================================================
   */

  if (
    key ===
    "match_result_home"
  ) {
    return homeScore >
      awayScore
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "match_result_draw"
  ) {
    return homeScore ===
      awayScore
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "match_result_away"
  ) {
    return awayScore >
      homeScore
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * DOUBLE CHANCE
   * ============================================================
   */

  if (
    key ===
    "double_chance_1x"
  ) {
    return homeScore >=
      awayScore
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "double_chance_x2"
  ) {
    return awayScore >=
      homeScore
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "double_chance_12"
  ) {
    return homeScore !==
      awayScore
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * DRAW NO BET
   *
   * Beraberlikte PUSH.
   * ============================================================
   */

  if (
    key ===
    "dnb_home"
  ) {
    if (
      homeScore ===
      awayScore
    ) {
      return "PUSH";
    }

    return homeScore >
      awayScore
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "dnb_away"
  ) {
    if (
      homeScore ===
      awayScore
    ) {
      return "PUSH";
    }

    return awayScore >
      homeScore
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * TOTAL GOALS
   * ============================================================
   */

  if (
    key.startsWith(
      "total_goals_over_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Total goals line okunamadı: ${key}`,
      );
    }

    return (
      homeScore +
        awayScore >
      line
        ? "WIN"
        : "LOSS"
    );
  }

  if (
    key.startsWith(
      "total_goals_under_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Total goals line okunamadı: ${key}`,
      );
    }

    return (
      homeScore +
        awayScore <
      line
        ? "WIN"
        : "LOSS"
    );
  }

  /*
   * ============================================================
   * HOME TEAM GOALS
   * ============================================================
   */

  if (
    key.startsWith(
      "home_team_goals_over_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Home team goal line okunamadı: ${key}`,
      );
    }

    return homeScore >
      line
      ? "WIN"
      : "LOSS";
  }

  if (
    key.startsWith(
      "home_team_goals_under_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Home team goal line okunamadı: ${key}`,
      );
    }

    return homeScore <
      line
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * AWAY TEAM GOALS
   * ============================================================
   */

  if (
    key.startsWith(
      "away_team_goals_over_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Away team goal line okunamadı: ${key}`,
      );
    }

    return awayScore >
      line
      ? "WIN"
      : "LOSS";
  }

  if (
    key.startsWith(
      "away_team_goals_under_",
    )
  ) {
    const line =
      parseLineFromKey(
        key,
      );

    if (
      line ===
      null
    ) {
      throw new Error(
        `Away team goal line okunamadı: ${key}`,
      );
    }

    return awayScore <
      line
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * BTTS
   * ============================================================
   */

  if (
    key ===
    "btts_yes"
  ) {
    return (
      homeScore >
        0 &&
      awayScore >
        0
    )
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "btts_no"
  ) {
    return (
      homeScore ===
        0 ||
      awayScore ===
        0
    )
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * CLEAN SHEET
   * ============================================================
   */

  if (
    key ===
    "home_clean_sheet_yes"
  ) {
    return awayScore ===
      0
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "home_clean_sheet_no"
  ) {
    return awayScore >
      0
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "away_clean_sheet_yes"
  ) {
    return homeScore ===
      0
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "away_clean_sheet_no"
  ) {
    return homeScore >
      0
      ? "WIN"
      : "LOSS";
  }

  /*
   * ============================================================
   * WIN TO NIL
   * ============================================================
   */

  if (
    key ===
    "home_win_to_nil_yes"
  ) {
    return (
      homeScore >
        awayScore &&
      awayScore ===
        0
    )
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "home_win_to_nil_no"
  ) {
    return (
      homeScore >
        awayScore &&
      awayScore ===
        0
    )
      ? "LOSS"
      : "WIN";
  }

  if (
    key ===
    "away_win_to_nil_yes"
  ) {
    return (
      awayScore >
        homeScore &&
      homeScore ===
        0
    )
      ? "WIN"
      : "LOSS";
  }

  if (
    key ===
    "away_win_to_nil_no"
  ) {
    return (
      awayScore >
        homeScore &&
      homeScore ===
        0
    )
      ? "LOSS"
      : "WIN";
  }

  throw new Error(
    `Backtest evaluator marketi tanımıyor: ${key}`,
  );
}

function createAggregate(
  selection:
    MarketSelection,
): MarketAggregate {
  return {
    key:
      selection.key,

    category:
      selection.category,

    market:
      selection.market,

    selection:
      selection.selection,

    predictions:
      0,

    wins:
      0,

    losses:
      0,

    pushes:
      0,

    probabilityTotal:
      0,

    brierTotal:
      0,

    highConfidence60Predictions:
      0,

    highConfidence60Wins:
      0,

    highConfidence70Predictions:
      0,

    highConfidence70Wins:
      0,

    highConfidence80Predictions:
      0,

    highConfidence80Wins:
      0,

    highConfidence90Predictions:
      0,

    highConfidence90Wins:
      0,
  };
}

function updateConfidenceBucket(
  options: {
    aggregate:
      MarketAggregate;

    probability:
      number;

    result:
      SelectionResult;
  },
): void {
  /*
   * PUSH seçimlerini threshold başarı
   * oranına katmıyoruz.
   */

  if (
    options.result ===
    "PUSH"
  ) {
    return;
  }

  if (
    options.probability >=
    60
  ) {
    options.aggregate
      .highConfidence60Predictions +=
      1;

    if (
      options.result ===
      "WIN"
    ) {
      options.aggregate
        .highConfidence60Wins +=
        1;
    }
  }

  if (
    options.probability >=
    70
  ) {
    options.aggregate
      .highConfidence70Predictions +=
      1;

    if (
      options.result ===
      "WIN"
    ) {
      options.aggregate
        .highConfidence70Wins +=
        1;
    }
  }

  if (
    options.probability >=
    80
  ) {
    options.aggregate
      .highConfidence80Predictions +=
      1;

    if (
      options.result ===
      "WIN"
    ) {
      options.aggregate
        .highConfidence80Wins +=
        1;
    }
  }

  if (
    options.probability >=
    90
  ) {
    options.aggregate
      .highConfidence90Predictions +=
      1;

    if (
      options.result ===
      "WIN"
    ) {
      options.aggregate
        .highConfidence90Wins +=
        1;
    }
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MARKET ENGINE HISTORICAL BACKTEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  const targetLeagueIds =
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
                targetLeagueIds,
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

  console.log(
    `Historical maç: ${matches.length}`,
  );

  console.log("");

  const aggregates =
    new Map<
      string,
      MarketAggregate
    >();

  let processedMatches =
    0;

  let failedMatches =
    0;

  let evaluatedSelections =
    0;

  for (
    let index = 0;
    index <
    matches.length;
    index += 1
  ) {
    const match =
      matches[index];

    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    try {
      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      const marketResult =
        calculateMarketsFromGoalModel(
          goalModel,
        );

      for (
        const selection
        of marketResult.selections
      ) {
        let aggregate =
          aggregates.get(
            selection.key,
          );

        if (
          !aggregate
        ) {
          aggregate =
            createAggregate(
              selection,
            );

          aggregates.set(
            selection.key,
            aggregate,
          );
        }

        const result =
          evaluateSelection({
            selection,

            homeScore:
              match.homeScore,

            awayScore:
              match.awayScore,
          });

        aggregate.predictions +=
          1;

        aggregate.probabilityTotal +=
          selection.probability;

        if (
          result ===
          "WIN"
        ) {
          aggregate.wins +=
            1;
        }

        if (
          result ===
          "LOSS"
        ) {
          aggregate.losses +=
            1;
        }

        if (
          result ===
          "PUSH"
        ) {
          aggregate.pushes +=
            1;
        }

        /*
         * Binary Brier:
         *
         * PUSH marketlerde sonuç oluşmadığı
         * için Brier hesabına katmıyoruz.
         */
        if (
          result !==
          "PUSH"
        ) {
          const predictedProbability =
            selection.probability /
            100;

          const actual =
            result ===
            "WIN"
              ? 1
              : 0;

          aggregate.brierTotal +=
            (
              predictedProbability -
              actual
            ) **
              2;
        }

        updateConfidenceBucket({
          aggregate,

          probability:
            selection.probability,

          result,
        });

        evaluatedSelections +=
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
          `[${index + 1}/${matches.length}] işlendi`,
        );
      }
    } catch (
      error
    ) {
      failedMatches +=
        1;

      console.error("");
      console.error(
        `FAILED: ${match.homeTeam.name} - ${match.awayTeam.name}`,
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  const results =
    [
      ...aggregates.values(),
    ]
      .map(
        (
          aggregate,
        ) => {
          const decisive =
            aggregate.wins +
            aggregate.losses;

          const averageProbability =
            aggregate.predictions >
            0
              ? aggregate
                  .probabilityTotal /
                aggregate.predictions
              : 0;

          const actualHitRate =
            percentage(
              aggregate.wins,
              decisive,
            );

          const calibrationGap =
            actualHitRate ===
            null
              ? null
              : round(
                  actualHitRate -
                    averageProbability,
                  2,
                );

          const brier =
            decisive >
            0
              ? aggregate.brierTotal /
                decisive
              : null;

          return {
            key:
              aggregate.key,

            category:
              aggregate.category,

            market:
              aggregate.market,

            selection:
              aggregate.selection,

            samples:
              aggregate.predictions,

            decisive,

            wins:
              aggregate.wins,

            losses:
              aggregate.losses,

            pushes:
              aggregate.pushes,

            avgProbability:
              round(
                averageProbability,
                2,
              ),

            hitRate:
              actualHitRate,

            calibrationGap,

            brier:
              brier ===
              null
                ? null
                : round(
                    brier,
                    4,
                  ),

            samples60:
              aggregate
                .highConfidence60Predictions,

            hit60:
              percentage(
                aggregate
                  .highConfidence60Wins,

                aggregate
                  .highConfidence60Predictions,
              ),

            samples70:
              aggregate
                .highConfidence70Predictions,

            hit70:
              percentage(
                aggregate
                  .highConfidence70Wins,

                aggregate
                  .highConfidence70Predictions,
              ),

            samples80:
              aggregate
                .highConfidence80Predictions,

            hit80:
              percentage(
                aggregate
                  .highConfidence80Wins,

                aggregate
                  .highConfidence80Predictions,
              ),

            samples90:
              aggregate
                .highConfidence90Predictions,

            hit90:
              percentage(
                aggregate
                  .highConfidence90Wins,

                aggregate
                  .highConfidence90Predictions,
              ),
          };
        },
      );

  /*
   * ============================================================
   * OVERALL RESULTS
   * ============================================================
   */

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
    "Historical matches":
      matches.length,

    "Processed matches":
      processedMatches,

    "Failed matches":
      failedMatches,

    "Market types":
      results.length,

    "Evaluated selections":
      evaluatedSelections,
  });

  /*
   * ============================================================
   * ALL MARKET RESULTS
   * ============================================================
   */

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

  /*
   * ============================================================
   * BEST CALIBRATED MARKETS
   * ============================================================
   *
   * En az 500 decisive sample.
   * Calibration gap mutlak değeri düşük.
   */

  const bestCalibrated =
    results
      .filter(
        (
          result,
        ) =>
          result.decisive >=
            500 &&
          result.calibrationGap !==
            null,
      )
      .sort(
        (
          left,
          right,
        ) =>
          Math.abs(
            left.calibrationGap ??
              999,
          ) -
          Math.abs(
            right.calibrationGap ??
              999,
          ),
      )
      .slice(
        0,
        15,
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "BEST CALIBRATED MARKETS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    bestCalibrated,
  );

  /*
   * ============================================================
   * BEST 70%+ CONFIDENCE PERFORMANCE
   * ============================================================
   */

  const highConfidence =
    results
      .filter(
        (
          result,
        ) =>
          result.samples70 >=
          100,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            right.hit70 ??
            0
          ) -
          (
            left.hit70 ??
            0
          ),
      )
      .slice(
        0,
        20,
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "70%+ CONFIDENCE PERFORMANCE",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    highConfidence.map(
      (
        result,
      ) => ({
        key:
          result.key,

        market:
          result.market,

        selection:
          result.selection,

        samples70:
          result.samples70,

        hit70:
          result.hit70,

        avgProbability:
          result.avgProbability,

        overallHit:
          result.hitRate,

        calibrationGap:
          result.calibrationGap,

        brier:
          result.brier,
      }),
    ),
  );

  /*
   * ============================================================
   * 80%+ CONFIDENCE PERFORMANCE
   * ============================================================
   */

  const veryHighConfidence =
    results
      .filter(
        (
          result,
        ) =>
          result.samples80 >=
          50,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            right.hit80 ??
            0
          ) -
          (
            left.hit80 ??
            0
          ),
      )
      .slice(
        0,
        20,
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "80%+ CONFIDENCE PERFORMANCE",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    veryHighConfidence.map(
      (
        result,
      ) => ({
        key:
          result.key,

        market:
          result.market,

        selection:
          result.selection,

        samples80:
          result.samples80,

        hit80:
          result.hit80,

        samples90:
          result.samples90,

        hit90:
          result.hit90,

        overallHit:
          result.hitRate,

        brier:
          result.brier,
      }),
    ),
  );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MARKET BACKTEST COMPLETE",
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