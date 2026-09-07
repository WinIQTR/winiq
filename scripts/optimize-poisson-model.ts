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

const SEASON_YEAR =
  2024;

const SMOOTHING_VALUES = [
  3,
  5,
  8,
  10,
] as const;

const RECENCY_VALUES = [
  0.88,
  0.92,
  0.96,
  1,
] as const;

const RHO_VALUES = [
  0,
  -0.04,
  -0.08,
  -0.12,
] as const;

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
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
): Outcome {
  if (
    probabilities.home >=
      probabilities.draw &&
    probabilities.home >=
      probabilities.away
  ) {
    return "HOME";
  }

  if (
    probabilities.draw >=
      probabilities.home &&
    probabilities.draw >=
      probabilities.away
  ) {
    return "DRAW";
  }

  return "AWAY";
}

function getActualProbability(
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
  outcome: Outcome,
  probabilities: {
    home: number;
    draw: number;
    away: number;
  },
): number {
  const actualHome =
    outcome ===
    "HOME"
      ? 1
      : 0;

  const actualDraw =
    outcome ===
    "DRAW"
      ? 1
      : 0;

  const actualAway =
    outcome ===
    "AWAY"
      ? 1
      : 0;

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

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "POISSON PARAMETER OPTIMIZER",
  );

  console.log(
    "========================================",
  );

  const leagueIds =
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
                leagueIds,
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
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  const combinations =
    SMOOTHING_VALUES.length *
    RECENCY_VALUES.length *
    RHO_VALUES.length;

  console.log("");
  console.log(
    `Historical maç: ${matches.length}`,
  );

  console.log(
    `Kombinasyon: ${combinations}`,
  );

  const results:
    Array<{
      smoothing: number;
      recency: number;
      rho: number;

      accuracy: number;
      brier: number;
      logLoss: number;

      homeRecall: number;
      drawRecall: number;
      awayRecall: number;

      balancePenalty: number;

      score: number;
    }> = [];

  let combinationIndex =
    0;

  for (
    const smoothing
    of SMOOTHING_VALUES
  ) {
    for (
      const recency
      of RECENCY_VALUES
    ) {
      for (
        const rho
        of RHO_VALUES
      ) {
        combinationIndex +=
          1;

        console.log("");
        console.log(
          `[${combinationIndex}/${combinations}] smoothing=${smoothing} recency=${recency} rho=${rho}`,
        );

        let processed =
          0;

        let correct =
          0;

        let totalBrier =
          0;

        let totalLogLoss =
          0;

        let homeActual =
          0;

        let drawActual =
          0;

        let awayActual =
          0;

        let homeCorrect =
          0;

        let drawCorrect =
          0;

        let awayCorrect =
          0;

        for (
          const match
          of matches
        ) {
          if (
            match.homeScore ===
              null ||
            match.awayScore ===
              null
          ) {
            continue;
          }

          const result =
            await calculateGoalProbabilities(
              match.id,
              {
                smoothingMatches:
                  smoothing,

                recencyDecay:
                  recency,

                dixonColesRho:
                  rho,
              },
            );

          processed +=
            1;

          const actual =
            determineOutcome(
              match.homeScore,
              match.awayScore,
            );

          const predicted =
            determinePrediction(
              result
                .outcomeProbabilities,
            );

          if (
            actual ===
            predicted
          ) {
            correct +=
              1;
          }

          if (
            actual ===
            "HOME"
          ) {
            homeActual +=
              1;

            if (
              predicted ===
              "HOME"
            ) {
              homeCorrect +=
                1;
            }
          }

          if (
            actual ===
            "DRAW"
          ) {
            drawActual +=
              1;

            if (
              predicted ===
              "DRAW"
            ) {
              drawCorrect +=
                1;
            }
          }

          if (
            actual ===
            "AWAY"
          ) {
            awayActual +=
              1;

            if (
              predicted ===
              "AWAY"
            ) {
              awayCorrect +=
                1;
            }
          }

          totalBrier +=
            calculateBrier(
              actual,
              result
                .outcomeProbabilities,
            );

          totalLogLoss +=
            -Math.log(
              Math.max(
                getActualProbability(
                  actual,
                  result
                    .outcomeProbabilities,
                ),
                MIN_PROBABILITY,
              ),
            );
        }

        if (
          processed ===
          0
        ) {
          continue;
        }

        const accuracy =
          (
            correct /
            processed
          ) *
          100;

        const homeRecall =
          homeActual >
          0
            ? (
                homeCorrect /
                homeActual
              ) *
              100
            : 0;

        const drawRecall =
          drawActual >
          0
            ? (
                drawCorrect /
                drawActual
              ) *
              100
            : 0;

        const awayRecall =
          awayActual >
          0
            ? (
                awayCorrect /
                awayActual
              ) *
              100
            : 0;

        const brier =
          totalBrier /
          processed;

        const logLoss =
          totalLogLoss /
          processed;

        const balancePenalty =
          Math.abs(
            homeRecall -
            awayRecall,
          );

        /*
         * Yüksek accuracy ödül.
         * Düşük Brier ödül.
         * Düşük LogLoss ödül.
         * HOME/AWAY aşırı dengesizlik ceza.
         * DRAW recall küçük destek.
         */
        const score =
          accuracy *
            0.4 -
          brier *
            20 -
          logLoss *
            5 -
          balancePenalty *
            0.08 +
          drawRecall *
            0.05;

        results.push({
          smoothing,

          recency,

          rho,

          accuracy:
            round(
              accuracy,
              2,
            ),

          brier:
            round(
              brier,
              6,
            ),

          logLoss:
            round(
              logLoss,
              6,
            ),

          homeRecall:
            round(
              homeRecall,
              2,
            ),

          drawRecall:
            round(
              drawRecall,
              2,
            ),

          awayRecall:
            round(
              awayRecall,
              2,
            ),

          balancePenalty:
            round(
              balancePenalty,
              2,
            ),

          score:
            round(
              score,
              4,
            ),
        });
      }
    }
  }

  results.sort(
    (
      left,
      right,
    ) =>
      right.score -
      left.score,
  );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TOP 15 PARAMETER SETS",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table(
    results.slice(
      0,
      15,
    ),
  );

  const best =
    results[0];

  console.log("");

  console.log(
    "========================================",
  );

  console.log(
    "BEST CONFIG",
  );

  console.log(
    "========================================",
  );

  console.log("");

  if (
    best
  ) {
    console.table({
      smoothing:
        best.smoothing,

      recency:
        best.recency,

      rho:
        best.rho,

      accuracy:
        best.accuracy,

      brier:
        best.brier,

      logLoss:
        best.logLoss,

      homeRecall:
        best.homeRecall,

      drawRecall:
        best.drawRecall,

      awayRecall:
        best.awayRecall,

      balancePenalty:
        best.balancePenalty,

      score:
        best.score,
    });
  }
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