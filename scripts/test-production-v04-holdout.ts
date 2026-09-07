import "dotenv/config";

import {
  ACTIVE_COMPETITION_API_IDS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

import {
  calculateGoalProbabilities,
} from "@/modules/goal-probability-engine";

import {
  applyDrawDecisionLayer,
  calculatePoissonConfidence,
} from "@/modules/prediction-engine";

import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

type EvaluatedRow = {
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

  homeScore:
    number;

  awayScore:
    number;

  actualOutcome:
    MatchOutcome;

  baselineOutcome:
    MatchOutcome;

  finalOutcome:
    MatchOutcome;

  homeProbability:
    number;

  drawProbability:
    number;

  awayProbability:
    number;

  predictedProbability:
    number;

  baselineCorrect:
    boolean;

  finalCorrect:
    boolean;

  drawOverride:
    boolean;

  confidenceScore:
    number;

  confidenceLevel:
    string;

  dataQualityScore:
    number;

  leagueMatches:
    number;

  homeVenueMatches:
    number;

  awayVenueMatches:
    number;

  probabilityGap:
    number;

  brier:
    number;

  logLoss:
    number;
};

type PerformanceRow = {
  group:
    string;

  matches:
    number;

  correct:
    number;

  accuracy:
    number;

  avgProbability:
    number;

  avgConfidence:
    number;

  avgDataQuality:
    number;

  brier:
    number;

  logLoss:
    number;
};

const SEASON_YEAR =
  2024;

const TEST_RATIO =
  0.2;

const EPSILON =
  1e-12;

function round(
  value: number,
  decimals = 4,
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

function actualOutcomeFromScore(
  homeScore: number,
  awayScore: number,
): MatchOutcome {
  if (
    homeScore >
    awayScore
  ) {
    return "HOME";
  }

  if (
    homeScore <
    awayScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

function getTopPrediction(
  probabilities:
    OutcomeProbabilities,
): {
  outcome:
    MatchOutcome;

  probability:
    number;
} {
  const values:
    Array<{
      outcome:
        MatchOutcome;

      probability:
        number;
    }> = [
    {
      outcome:
        "HOME",

      probability:
        probabilities.home,
    },

    {
      outcome:
        "DRAW",

      probability:
        probabilities.draw,
    },

    {
      outcome:
        "AWAY",

      probability:
        probabilities.away,
    },
  ];

  values.sort(
    (
      left,
      right,
    ) =>
      right.probability -
      left.probability,
  );

  return values[0];
}

function getOutcomeProbability(
  probabilities:
    OutcomeProbabilities,

  outcome:
    MatchOutcome,
): number {
  switch (
    outcome
  ) {
    case "HOME":
      return probabilities.home;

    case "DRAW":
      return probabilities.draw;

    case "AWAY":
      return probabilities.away;
  }
}

function calculateBrierScore(
  probabilities:
    OutcomeProbabilities,

  actualOutcome:
    MatchOutcome,
): number {
  const home =
    probabilities.home /
    100;

  const draw =
    probabilities.draw /
    100;

  const away =
    probabilities.away /
    100;

  const actualHome =
    actualOutcome ===
    "HOME"
      ? 1
      : 0;

  const actualDraw =
    actualOutcome ===
    "DRAW"
      ? 1
      : 0;

  const actualAway =
    actualOutcome ===
    "AWAY"
      ? 1
      : 0;

  return (
    (
      home -
      actualHome
    ) **
      2 +
    (
      draw -
      actualDraw
    ) **
      2 +
    (
      away -
      actualAway
    ) **
      2
  );
}

function calculateLogLoss(
  probabilities:
    OutcomeProbabilities,

  actualOutcome:
    MatchOutcome,
): number {
  const probability =
    getOutcomeProbability(
      probabilities,
      actualOutcome,
    ) /
    100;

  return (
    -Math.log(
      Math.max(
        probability,
        EPSILON,
      ),
    )
  );
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator ===
    0
  ) {
    return 0;
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

function average(
  values: number[],
): number {
  if (
    values.length ===
    0
  ) {
    return 0;
  }

  return round(
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    ) /
      values.length,
    4,
  );
}

function createPerformanceRow(
  options: {
    name:
      string;

    rows:
      EvaluatedRow[];
  },
): PerformanceRow {
  const correct =
    options.rows.filter(
      (
        row,
      ) =>
        row.finalCorrect,
    ).length;

  return {
    group:
      options.name,

    matches:
      options.rows.length,

    correct,

    accuracy:
      percentage(
        correct,
        options.rows.length,
      ),

    avgProbability:
      average(
        options.rows.map(
          (
            row,
          ) =>
            row.predictedProbability,
        ),
      ),

    avgConfidence:
      average(
        options.rows.map(
          (
            row,
          ) =>
            row.confidenceScore,
        ),
      ),

    avgDataQuality:
      average(
        options.rows.map(
          (
            row,
          ) =>
            row.dataQualityScore,
        ),
      ),

    brier:
      average(
        options.rows.map(
          (
            row,
          ) =>
            row.brier,
        ),
      ),

    logLoss:
      average(
        options.rows.map(
          (
            row,
          ) =>
            row.logLoss,
        ),
      ),
  };
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION POISSON V0.4 HOLDOUT BACKTEST",
  );

  console.log(
    "==============================================",
  );

  /*
   * Bütün 2024 bitmiş maçları
   * kronolojik sıraya koyuyoruz.
   */
  const allMatches =
    await prisma
      .match
      .findMany({
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
      });

  if (
    allMatches.length <
    100
  ) {
    throw new Error(
      `Holdout için yeterli maç yok. Bulunan: ${allMatches.length}`,
    );
  }

  /*
   * En son %20 bağımsız TEST.
   */
  const testCount =
    Math.max(
      1,

      Math.floor(
        allMatches.length *
          TEST_RATIO,
      ),
    );

  const testStartIndex =
    allMatches.length -
    testCount;

  const trainingReference =
    allMatches.slice(
      0,
      testStartIndex,
    );

  const testMatches =
    allMatches.slice(
      testStartIndex,
    );

  console.log("");
  console.log(
    "CHRONOLOGICAL HOLDOUT",
  );

  console.table({
    Season:
      SEASON_YEAR,

    "All matches":
      allMatches.length,

    "Historical reference":
      trainingReference.length,

    "Independent test":
      testMatches.length,

    "Test ratio":
      `${round(
        TEST_RATIO *
          100,
        2,
      )}%`,

    "Historical start":
      trainingReference[
        0
      ]?.kickoffAt.toISOString() ??
      "-",

    "Historical end":
      trainingReference[
        trainingReference.length -
          1
      ]?.kickoffAt.toISOString() ??
      "-",

    "Test start":
      testMatches[
        0
      ]?.kickoffAt.toISOString() ??
      "-",

    "Test end":
      testMatches[
        testMatches.length -
          1
      ]?.kickoffAt.toISOString() ??
      "-",
  });

  const rows:
    EvaluatedRow[] =
      [];

  const failures:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    let index =
      0;

    index <
    testMatches.length;

    index +=
      1
  ) {
    const match =
      testMatches[
        index
      ];

    const homeScore =
      match.homeScore;

    const awayScore =
      match.awayScore;

    if (
      homeScore ===
        null ||
      awayScore ===
        null
    ) {
      continue;
    }

    try {
      /*
       * calculateGoalProbabilities V0.4
       * kendi içinde:
       *
       * kickoffAt < current match kickoff
       *
       * şartını kullanır.
       *
       * Böylece gelecekteki maçların
       * sonuçları historical hesaplamaya
       * sızmaz.
       */
      const goalModel =
        await calculateGoalProbabilities(
          match.id,
        );

      const probabilities:
        OutcomeProbabilities = {
        home:
          goalModel
            .outcomeProbabilities
            .home,

        draw:
          goalModel
            .outcomeProbabilities
            .draw,

        away:
          goalModel
            .outcomeProbabilities
            .away,
      };

      const baseline =
        getTopPrediction(
          probabilities,
        );

      const drawDecision =
        applyDrawDecisionLayer({
          probabilities,
        });

      const finalOutcome =
        drawDecision
          .selectedOutcome;

      const actualOutcome =
        actualOutcomeFromScore(
          homeScore,
          awayScore,
        );

      const confidence =
        calculatePoissonConfidence({
          goalModel,

          probabilities,

          finalOutcome,

          drawDecision,
        });

      rows.push({
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

        homeScore,

        awayScore,

        actualOutcome,

        baselineOutcome:
          baseline.outcome,

        finalOutcome,

        homeProbability:
          probabilities.home,

        drawProbability:
          probabilities.draw,

        awayProbability:
          probabilities.away,

        predictedProbability:
          getOutcomeProbability(
            probabilities,
            finalOutcome,
          ),

        baselineCorrect:
          baseline.outcome ===
          actualOutcome,

        finalCorrect:
          finalOutcome ===
          actualOutcome,

        drawOverride:
          drawDecision.applied,

        confidenceScore:
          confidence.score,

        confidenceLevel:
          confidence.level,

        dataQualityScore:
          confidence
            .dataQualityScore,

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

        probabilityGap:
          confidence
            .probabilityGap,

        brier:
          calculateBrierScore(
            probabilities,
            actualOutcome,
          ),

        logLoss:
          calculateLogLoss(
            probabilities,
            actualOutcome,
          ),
      });

      if (
        (
          index +
          1
        ) %
          50 ===
        0
      ) {
        const processed =
          rows.length;

        const correct =
          rows.filter(
            (
              row,
            ) =>
              row.finalCorrect,
          ).length;

        console.log(
          [
            `TEST ${index + 1}/${testMatches.length}`,
            `processed ${processed}`,
            `correct ${correct}`,
            `accuracy ${percentage(
              correct,
              processed,
            )}%`,
          ].join(
            " • ",
          ),
        );
      }
    } catch (
      error: unknown
    ) {
      failures.push({
        matchId:
          match.id,

        match:
          `${match.homeTeam.name} - ${match.awayTeam.name}`,

        league:
          match
            .season
            .league
            .name,

        kickoff:
          match
            .kickoffAt
            .toISOString(),

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }

  if (
    rows.length ===
    0
  ) {
    throw new Error(
      "Backtest sonucunda işlenen maç bulunamadı.",
    );
  }

  /*
   * ==================================================
   * OVERALL
   * ==================================================
   */

  const finalCorrect =
    rows.filter(
      (
        row,
      ) =>
        row.finalCorrect,
    ).length;

  const baselineCorrect =
    rows.filter(
      (
        row,
      ) =>
        row.baselineCorrect,
    ).length;

  const drawOverrides =
    rows.filter(
      (
        row,
      ) =>
        row.drawOverride,
    );

  const drawOverrideCorrect =
    drawOverrides.filter(
      (
        row,
      ) =>
        row.finalCorrect,
    ).length;

  const baselineOnOverrideCorrect =
    drawOverrides.filter(
      (
        row,
      ) =>
        row.baselineCorrect,
    ).length;

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "OVERALL RESULT",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Expected test matches":
      testMatches.length,

    Processed:
      rows.length,

    Failed:
      failures.length,

    "Baseline correct":
      baselineCorrect,

    "Baseline accuracy":
      `${percentage(
        baselineCorrect,
        rows.length,
      )}%`,

    "Final correct":
      finalCorrect,

    "Final accuracy":
      `${percentage(
        finalCorrect,
        rows.length,
      )}%`,

    "Accuracy delta":
      round(
        percentage(
          finalCorrect,
          rows.length,
        ) -
          percentage(
            baselineCorrect,
            rows.length,
          ),
        2,
      ),

    Brier:
      average(
        rows.map(
          (
            row,
          ) =>
            row.brier,
        ),
      ),

    "Log Loss":
      average(
        rows.map(
          (
            row,
          ) =>
            row.logLoss,
        ),
      ),

    "DRAW override":
      drawOverrides.length,

    "DRAW override correct":
      drawOverrideCorrect,

    "DRAW override accuracy":
      `${percentage(
        drawOverrideCorrect,
        drawOverrides.length,
      )}%`,

    "Baseline correct on override":
      baselineOnOverrideCorrect,
  });

  /*
   * ==================================================
   * OUTCOME PERFORMANCE
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "FINAL OUTCOME PERFORMANCE",
  );

  console.log(
    "==============================================",
  );

  console.table(
    (
      [
        "HOME",
        "DRAW",
        "AWAY",
      ] as const
    ).map(
      (
        outcome,
      ) => {
        const predicted =
          rows.filter(
            (
              row,
            ) =>
              row.finalOutcome ===
              outcome,
          );

        const actual =
          rows.filter(
            (
              row,
            ) =>
              row.actualOutcome ===
              outcome,
          );

        const correct =
          predicted.filter(
            (
              row,
            ) =>
              row.finalCorrect,
          ).length;

        return {
          outcome,

          actual:
            actual.length,

          predicted:
            predicted.length,

          correct,

          precision:
            percentage(
              correct,
              predicted.length,
            ),

          recall:
            percentage(
              correct,
              actual.length,
            ),
        };
      },
    ),
  );

  /*
   * ==================================================
   * CONFIDENCE VALIDATION
   * ==================================================
   */

  const confidenceGroups = [
    "VERY_HIGH",
    "HIGH",
    "MEDIUM",
    "LOW",
    "VERY_LOW",
  ] as const;

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CONFIDENCE VALIDATION",
  );

  console.log(
    "==============================================",
  );

  console.table(
    confidenceGroups.map(
      (
        level,
      ) =>
        createPerformanceRow({
          name:
            level,

          rows:
            rows.filter(
              (
                row,
              ) =>
                row.confidenceLevel ===
                level,
            ),
        }),
    ),
  );

  /*
   * ==================================================
   * CONFIDENCE NUMERIC BANDS
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CONFIDENCE SCORE BANDS",
  );

  console.log(
    "==============================================",
  );

  const confidenceBands = [
    {
      label:
        "0-39.99",

      minimum:
        0,

      maximum:
        40,
    },

    {
      label:
        "40-54.99",

      minimum:
        40,

      maximum:
        55,
    },

    {
      label:
        "55-69.99",

      minimum:
        55,

      maximum:
        70,
    },

    {
      label:
        "70-84.99",

      minimum:
        70,

      maximum:
        85,
    },

    {
      label:
        "85-100",

      minimum:
        85,

      maximum:
        100.0001,
    },
  ];

  console.table(
    confidenceBands.map(
      (
        band,
      ) =>
        createPerformanceRow({
          name:
            band.label,

          rows:
            rows.filter(
              (
                row,
              ) =>
                row.confidenceScore >=
                  band.minimum &&
                row.confidenceScore <
                  band.maximum,
            ),
        }),
    ),
  );

  /*
   * ==================================================
   * DATA QUALITY
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DATA QUALITY VALIDATION",
  );

  console.log(
    "==============================================",
  );

  console.table([
    createPerformanceRow({
      name:
        "DATA 100",

      rows:
        rows.filter(
          (
            row,
          ) =>
            row.dataQualityScore >=
            99.99,
        ),
    }),

    createPerformanceRow({
      name:
        "DATA 65-99",

      rows:
        rows.filter(
          (
            row,
          ) =>
            row.dataQualityScore >=
              65 &&
            row.dataQualityScore <
              99.99,
        ),
    }),

    createPerformanceRow({
      name:
        "DATA 50-64",

      rows:
        rows.filter(
          (
            row,
          ) =>
            row.dataQualityScore >=
              50 &&
            row.dataQualityScore <
              65,
        ),
    }),

    createPerformanceRow({
      name:
        "DATA <50",

      rows:
        rows.filter(
          (
            row,
          ) =>
            row.dataQualityScore <
            50,
        ),
    }),
  ]);

  /*
   * ==================================================
   * LEAGUE PERFORMANCE
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEAGUE PERFORMANCE",
  );

  console.log(
    "==============================================",
  );

  const leagueIds =
    [
      ...new Set(
        rows.map(
          (
            row,
          ) =>
            row.leagueApiId,
        ),
      ),
    ];

  const leaguePerformance =
    leagueIds.map(
      (
        leagueApiId,
      ) => {
        const leagueRows =
          rows.filter(
            (
              row,
            ) =>
              row.leagueApiId ===
              leagueApiId,
          );

        const first =
          leagueRows[
            0
          ];

        const performance =
          createPerformanceRow({
            name:
              first
                ?.leagueName ??
              String(
                leagueApiId,
              ),

            rows:
              leagueRows,
          });

        return {
          ...performance,

          avgHomeVenue:
            average(
              leagueRows.map(
                (
                  row,
                ) =>
                  row.homeVenueMatches,
              ),
            ),

          avgAwayVenue:
            average(
              leagueRows.map(
                (
                  row,
                ) =>
                  row.awayVenueMatches,
              ),
            ),

          drawOverrides:
            leagueRows.filter(
              (
                row,
              ) =>
                row.drawOverride,
            ).length,
        };
      },
    );

  leaguePerformance.sort(
    (
      left,
      right,
    ) =>
      right.accuracy -
      left.accuracy,
  );

  console.table(
    leaguePerformance,
  );

  /*
   * ==================================================
   * PUBLISHABLE SIMULATION
   * ==================================================
   */

  const publishable =
    rows.filter(
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
    "PUBLISHABLE FILTER BACKTEST",
  );

  console.log(
    "==============================================",
  );

  console.table(
    [
      createPerformanceRow({
        name:
          "HIGH/VERY_HIGH + DATA>=65 + P>=45",

        rows:
          publishable,
      }),
    ],
  );

  /*
   * Daha sıkı filtre.
   */
  const strictPublishable =
    rows.filter(
      (
        row,
      ) =>
        row.confidenceScore >=
          85 &&
        row.dataQualityScore >=
          80 &&
        row.predictedProbability >=
          50 &&
        !row.drawOverride,
    );

  console.table(
    [
      createPerformanceRow({
        name:
          "STRICT C>=85 D>=80 P>=50 NO_DRAW_OVERRIDE",

        rows:
          strictPublishable,
      }),
    ],
  );

  /*
   * ==================================================
   * DRAW OVERRIDE
   * ==================================================
   */

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW OVERRIDE AUDIT",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Overrides:
      drawOverrides.length,

    "Actual DRAW":
      drawOverrides.filter(
        (
          row,
        ) =>
          row.actualOutcome ===
          "DRAW",
      ).length,

    "Override correct":
      drawOverrideCorrect,

    "Override accuracy":
      percentage(
        drawOverrideCorrect,
        drawOverrides.length,
      ),

    "Baseline would be correct":
      baselineOnOverrideCorrect,

    "Net correct delta":
      drawOverrideCorrect -
      baselineOnOverrideCorrect,
  });

  if (
    drawOverrides.length >
    0
  ) {
    console.table(
      drawOverrides
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

            score:
              `${row.homeScore}-${row.awayScore}`,

            actual:
              row.actualOutcome,

            baseline:
              row.baselineOutcome,

            final:
              row.finalOutcome,

            drawProbability:
              row.drawProbability,

            confidence:
              row.confidenceScore,

            dataQuality:
              row.dataQualityScore,

            correct:
              row.finalCorrect
                ? "YES"
                : "NO",
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
    failures.length >
    0
  ) {
    console.log("");
    console.log(
      "==============================================",
    );

    console.log(
      "FAILURES",
    );

    console.log(
      "==============================================",
    );

    console.table(
      failures,
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION POISSON V0.4 HOLDOUT TAMAMLANDI",
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
        "Production Poisson V0.4 holdout başarısız.",
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