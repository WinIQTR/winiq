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

type Outcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

type CompetitionResult = {
  apiId: number;
  competition: string;

  matches: number;
  correct: number;

  homeActual: number;
  homePredicted: number;
  homeCorrect: number;

  drawActual: number;
  drawPredicted: number;
  drawCorrect: number;

  awayActual: number;
  awayPredicted: number;
  awayCorrect: number;

  brierTotal: number;
  logLossTotal: number;

  homeGoalAbsoluteError: number;
  awayGoalAbsoluteError: number;

  over25Correct: number;
  bttsCorrect: number;
};

const SEASON_YEAR =
  2024;

const MIN_PROBABILITY =
  1e-15;

function round(
  value: number,
  decimals = 4,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) /
    factor
  );
}

function determineOutcome(
  homeScore: number,
  awayScore: number,
): Outcome {
  if (
    homeScore >
    awayScore
  ) {
    return "HOME";
  }

  if (
    awayScore >
    homeScore
  ) {
    return "AWAY";
  }

  return "DRAW";
}

function determinePrediction(
  options: {
    home: number;
    draw: number;
    away: number;
  },
): Outcome {
  if (
    options.home >=
      options.draw &&
    options.home >=
      options.away
  ) {
    return "HOME";
  }

  if (
    options.draw >=
      options.home &&
    options.draw >=
      options.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

function probabilityForOutcome(
  outcome: Outcome,
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
): number {
  switch (outcome) {
    case "HOME":
      return (
        probabilities.home /
        100
      );

    case "DRAW":
      return (
        probabilities.draw /
        100
      );

    case "AWAY":
      return (
        probabilities.away /
        100
      );
  }
}

function calculateBrier(
  actualOutcome: Outcome,
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
): number {
  const actual = {
    HOME:
      actualOutcome ===
      "HOME"
        ? 1
        : 0,

    DRAW:
      actualOutcome ===
      "DRAW"
        ? 1
        : 0,

    AWAY:
      actualOutcome ===
      "AWAY"
        ? 1
        : 0,
  };

  const home =
    probabilities.home /
    100;

  const draw =
    probabilities.draw /
    100;

  const away =
    probabilities.away /
    100;

  return (
    (
      home -
      actual.HOME
    ) **
      2 +
    (
      draw -
      actual.DRAW
    ) **
      2 +
    (
      away -
      actual.AWAY
    ) **
      2
  );
}

function createCompetitionResult(
  apiId: number,
  competition: string,
): CompetitionResult {
  return {
    apiId,
    competition,

    matches:
      0,

    correct:
      0,

    homeActual:
      0,

    homePredicted:
      0,

    homeCorrect:
      0,

    drawActual:
      0,

    drawPredicted:
      0,

    drawCorrect:
      0,

    awayActual:
      0,

    awayPredicted:
      0,

    awayCorrect:
      0,

    brierTotal:
      0,

    logLossTotal:
      0,

    homeGoalAbsoluteError:
      0,

    awayGoalAbsoluteError:
      0,

    over25Correct:
      0,

    bttsCorrect:
      0,
  };
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

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "POISSON V0.1 HISTORICAL BACKTEST",
  );

  console.log(
    "========================================",
  );

  console.log("");

  const competitionApiIds =
    ACTIVE_COMPETITIONS.map(
      (competition) =>
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
                competitionApiIds,
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

  const competitionResults =
    new Map<
      number,
      CompetitionResult
    >();

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    competitionResults.set(
      competition.apiId,
      createCompetitionResult(
        competition.apiId,
        competition.name,
      ),
    );
  }

  let failed =
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

    const leagueApiId =
      match.season
        .league
        .apiId;

    const aggregate =
      competitionResults.get(
        leagueApiId,
      );

    if (
      !aggregate
    ) {
      continue;
    }

    try {
      const result =
        await calculateGoalProbabilities(
          match.id,
        );

      const actualOutcome =
        determineOutcome(
          match.homeScore,
          match.awayScore,
        );

      const predictedOutcome =
        determinePrediction(
          result.outcomeProbabilities,
        );

      aggregate.matches +=
        1;

      if (
        actualOutcome ===
        predictedOutcome
      ) {
        aggregate.correct +=
          1;
      }

      /*
       * Actual sınıflar
       */
      if (
        actualOutcome ===
        "HOME"
      ) {
        aggregate.homeActual +=
          1;
      }

      if (
        actualOutcome ===
        "DRAW"
      ) {
        aggregate.drawActual +=
          1;
      }

      if (
        actualOutcome ===
        "AWAY"
      ) {
        aggregate.awayActual +=
          1;
      }

      /*
       * Predicted sınıflar
       */
      if (
        predictedOutcome ===
        "HOME"
      ) {
        aggregate.homePredicted +=
          1;
      }

      if (
        predictedOutcome ===
        "DRAW"
      ) {
        aggregate.drawPredicted +=
          1;
      }

      if (
        predictedOutcome ===
        "AWAY"
      ) {
        aggregate.awayPredicted +=
          1;
      }

      if (
        actualOutcome ===
          "HOME" &&
        predictedOutcome ===
          "HOME"
      ) {
        aggregate.homeCorrect +=
          1;
      }

      if (
        actualOutcome ===
          "DRAW" &&
        predictedOutcome ===
          "DRAW"
      ) {
        aggregate.drawCorrect +=
          1;
      }

      if (
        actualOutcome ===
          "AWAY" &&
        predictedOutcome ===
          "AWAY"
      ) {
        aggregate.awayCorrect +=
          1;
      }

      /*
       * Probability scoring
       */
      aggregate.brierTotal +=
        calculateBrier(
          actualOutcome,
          result
            .outcomeProbabilities,
        );

      const actualProbability =
        probabilityForOutcome(
          actualOutcome,
          result
            .outcomeProbabilities,
        );

      aggregate.logLossTotal +=
        -Math.log(
          Math.max(
            actualProbability,
            MIN_PROBABILITY,
          ),
        );

      /*
       * Beklenen gol MAE
       */
      aggregate
        .homeGoalAbsoluteError +=
        Math.abs(
          result
            .expectedGoals
            .home -
          match.homeScore,
        );

      aggregate
        .awayGoalAbsoluteError +=
        Math.abs(
          result
            .expectedGoals
            .away -
          match.awayScore,
        );

      /*
       * Over / Under 2.5
       */
      const over25 =
        result.totals.find(
          (line) =>
            line.line ===
            2.5,
        );

      if (
        over25
      ) {
        const predictedOver =
          over25.over >=
          over25.under;

        const actualOver =
          match.homeScore +
            match.awayScore >
          2.5;

        if (
          predictedOver ===
          actualOver
        ) {
          aggregate.over25Correct +=
            1;
        }
      }

      /*
       * BTTS
       */
      const predictedBtts =
        result.btts.yes >=
        result.btts.no;

      const actualBtts =
        match.homeScore >
          0 &&
        match.awayScore >
          0;

      if (
        predictedBtts ===
        actualBtts
      ) {
        aggregate.bttsCorrect +=
          1;
      }

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
      failed +=
        1;

      console.error(
        `[${index + 1}] FAILED • ${match.homeTeam.name} - ${match.awayTeam.name}`,
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  const rows =
    ACTIVE_COMPETITIONS.map(
      (competition) => {
        const result =
          competitionResults.get(
            competition.apiId,
          )!;

        return {
          apiId:
            result.apiId,

          competition:
            result.competition,

          matches:
            result.matches,

          accuracy:
            percentage(
              result.correct,
              result.matches,
            ),

          homeRecall:
            percentage(
              result.homeCorrect,
              result.homeActual,
            ),

          drawRecall:
            percentage(
              result.drawCorrect,
              result.drawActual,
            ),

          awayRecall:
            percentage(
              result.awayCorrect,
              result.awayActual,
            ),

          drawPredicted:
            result.drawPredicted,

          brier:
            result.matches >
            0
              ? round(
                  result.brierTotal /
                    result.matches,
                )
              : null,

          logLoss:
            result.matches >
            0
              ? round(
                  result.logLossTotal /
                    result.matches,
                )
              : null,

          homeGoalMae:
            result.matches >
            0
              ? round(
                  result
                    .homeGoalAbsoluteError /
                    result.matches,
                  3,
                )
              : null,

          awayGoalMae:
            result.matches >
            0
              ? round(
                  result
                    .awayGoalAbsoluteError /
                    result.matches,
                  3,
                )
              : null,

          over25Accuracy:
            percentage(
              result.over25Correct,
              result.matches,
            ),

          bttsAccuracy:
            percentage(
              result.bttsCorrect,
              result.matches,
            ),
        };
      },
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "COMPETITION RESULTS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    rows,
  );

  const global =
    [...competitionResults.values()]
      .reduce(
        (
          total,
          result,
        ) => {
          total.matches +=
            result.matches;

          total.correct +=
            result.correct;

          total.homeActual +=
            result.homeActual;

          total.homeCorrect +=
            result.homeCorrect;

          total.drawActual +=
            result.drawActual;

          total.drawPredicted +=
            result.drawPredicted;

          total.drawCorrect +=
            result.drawCorrect;

          total.awayActual +=
            result.awayActual;

          total.awayCorrect +=
            result.awayCorrect;

          total.brierTotal +=
            result.brierTotal;

          total.logLossTotal +=
            result.logLossTotal;

          total.homeGoalAbsoluteError +=
            result
              .homeGoalAbsoluteError;

          total.awayGoalAbsoluteError +=
            result
              .awayGoalAbsoluteError;

          total.over25Correct +=
            result.over25Correct;

          total.bttsCorrect +=
            result.bttsCorrect;

          return total;
        },
        createCompetitionResult(
          0,
          "GLOBAL",
        ),
      );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "GLOBAL RESULT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    Matches:
      global.matches,

    Failed:
      failed,

    Accuracy:
      percentage(
        global.correct,
        global.matches,
      ),

    "HOME Recall":
      percentage(
        global.homeCorrect,
        global.homeActual,
      ),

    "DRAW Actual":
      global.drawActual,

    "DRAW Predicted":
      global.drawPredicted,

    "DRAW Correct":
      global.drawCorrect,

    "DRAW Recall":
      percentage(
        global.drawCorrect,
        global.drawActual,
      ),

    "AWAY Recall":
      percentage(
        global.awayCorrect,
        global.awayActual,
      ),

    Brier:
      round(
        global.brierTotal /
          global.matches,
      ),

    "Log Loss":
      round(
        global.logLossTotal /
          global.matches,
      ),

    "Home Goal MAE":
      round(
        global
          .homeGoalAbsoluteError /
          global.matches,
        3,
      ),

    "Away Goal MAE":
      round(
        global
          .awayGoalAbsoluteError /
          global.matches,
        3,
      ),

    "Over 2.5 Accuracy":
      percentage(
        global.over25Correct,
        global.matches,
      ),

    "BTTS Accuracy":
      percentage(
        global.bttsCorrect,
        global.matches,
      ),
  });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "POISSON BACKTEST COMPLETE",
  );

  console.log(
    "========================================",
  );
}

main()
  .catch(
    (
      error: unknown,
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