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

type Probabilities = {
  home: number;
  draw: number;
  away: number;
};

type DrawDecisionConfig = {
  minimumDrawProbability:
    number;

  maximumDrawGap:
    number;
};

type Aggregate = {
  matches: number;

  correct: number;

  homeActual: number;
  drawActual: number;
  awayActual: number;

  homePredicted: number;
  drawPredicted: number;
  awayPredicted: number;

  homeCorrect: number;
  drawCorrect: number;
  awayCorrect: number;
};

const SEASON_YEAR =
  2024;

const TRAINING_PERCENTAGE =
  70;

const MINIMUM_DRAW_PROBABILITIES = [
  20,
  22,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
  32,
] as const;

const MAXIMUM_DRAW_GAPS = [
  0,
  2,
  4,
  5,
  6,
  7,
  8,
  10,
  12,
  15,
] as const;

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

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator <=
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

function determineActualOutcome(
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

function determineArgmax(
  probabilities:
    Probabilities,
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

function determineWithDrawLayer(
  probabilities:
    Probabilities,

  config:
    DrawDecisionConfig,
): Outcome {
  const normalOutcome =
    determineArgmax(
      probabilities,
    );

  /*
   * DRAW zaten en yüksekse
   * doğrudan DRAW.
   */
  if (
    normalOutcome ===
    "DRAW"
  ) {
    return "DRAW";
  }

  const strongestNonDraw =
    Math.max(
      probabilities.home,
      probabilities.away,
    );

  const drawGap =
    strongestNonDraw -
    probabilities.draw;

  /*
   * Beraberlik olasılığı yeterli ve
   * HOME/AWAY liderine yeterince yakınsa
   * DRAW seçilir.
   */
  if (
    probabilities.draw >=
      config
        .minimumDrawProbability &&
    drawGap <=
      config
        .maximumDrawGap
  ) {
    return "DRAW";
  }

  return normalOutcome;
}

function createAggregate():
  Aggregate {
  return {
    matches:
      0,

    correct:
      0,

    homeActual:
      0,

    drawActual:
      0,

    awayActual:
      0,

    homePredicted:
      0,

    drawPredicted:
      0,

    awayPredicted:
      0,

    homeCorrect:
      0,

    drawCorrect:
      0,

    awayCorrect:
      0,
  };
}

function updateAggregate(
  aggregate:
    Aggregate,

  actual:
    Outcome,

  predicted:
    Outcome,
): void {
  aggregate.matches +=
    1;

  if (
    actual ===
    "HOME"
  ) {
    aggregate.homeActual +=
      1;
  } else if (
    actual ===
    "DRAW"
  ) {
    aggregate.drawActual +=
      1;
  } else {
    aggregate.awayActual +=
      1;
  }

  if (
    predicted ===
    "HOME"
  ) {
    aggregate.homePredicted +=
      1;
  } else if (
    predicted ===
    "DRAW"
  ) {
    aggregate.drawPredicted +=
      1;
  } else {
    aggregate.awayPredicted +=
      1;
  }

  if (
    actual ===
    predicted
  ) {
    aggregate.correct +=
      1;
  }

  if (
    actual ===
      "HOME" &&
    predicted ===
      "HOME"
  ) {
    aggregate.homeCorrect +=
      1;
  }

  if (
    actual ===
      "DRAW" &&
    predicted ===
      "DRAW"
  ) {
    aggregate.drawCorrect +=
      1;
  }

  if (
    actual ===
      "AWAY" &&
    predicted ===
      "AWAY"
  ) {
    aggregate.awayCorrect +=
      1;
  }
}

function calculateScore(
  aggregate:
    Aggregate,
): number {
  const accuracy =
    percentage(
      aggregate.correct,
      aggregate.matches,
    );

  const homeRecall =
    percentage(
      aggregate.homeCorrect,
      aggregate.homeActual,
    );

  const drawRecall =
    percentage(
      aggregate.drawCorrect,
      aggregate.drawActual,
    );

  const drawPrecision =
    percentage(
      aggregate.drawCorrect,
      aggregate.drawPredicted,
    );

  const awayRecall =
    percentage(
      aggregate.awayCorrect,
      aggregate.awayActual,
    );

  /*
   * Precision'ın küçük örneklemle
   * skoru yapay yükseltmesini önlemek
   * için DRAW sample factor ekliyoruz.
   */
  const drawSampleFactor =
    Math.min(
      aggregate.drawPredicted /
        100,
      1,
    );

  return round(
    accuracy *
      0.55 +
      homeRecall *
        0.08 +
      awayRecall *
        0.08 +
      drawRecall *
        0.16 +
      drawPrecision *
        0.13 *
        drawSampleFactor,
    4,
  );
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW DECISION LAYER V1",
  );

  console.log(
    "==============================================",
  );

  const competitionApiIds =
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
    });

  const splitIndex =
    Math.floor(
      matches.length *
        (
          TRAINING_PERCENTAGE /
          100
        ),
    );

  const validation =
    matches.slice(
      splitIndex,
    );

  console.table({
    "All matches":
      matches.length,

    "Validation matches":
      validation.length,

    "Split date":
      validation[
        0
      ]?.kickoffAt
        .toISOString(),
  });

  const configurations:
    DrawDecisionConfig[] =
      [];

  for (
    const minimumDrawProbability
    of MINIMUM_DRAW_PROBABILITIES
  ) {
    for (
      const maximumDrawGap
      of MAXIMUM_DRAW_GAPS
    ) {
      configurations.push({
        minimumDrawProbability,

        maximumDrawGap,
      });
    }
  }

  /*
   * Baseline + bütün threshold
   * kombinasyonları.
   */
  const baseline =
    createAggregate();

  const aggregates =
    new Map<
      string,
      Aggregate
    >();

  for (
    const config
    of configurations
  ) {
    aggregates.set(
      [
        config
          .minimumDrawProbability,
        config
          .maximumDrawGap,
      ].join(
        ":",
      ),
      createAggregate(),
    );
  }

  let processed =
    0;

  let failed =
    0;

  for (
    const match
    of validation
  ) {
    if (
      match.homeScore ===
        null ||
      match.awayScore ===
        null
    ) {
      continue;
    }

    try {
      const result =
        await calculateGoalProbabilities(
          match.id,
        );

      const probabilities:
        Probabilities = {
        home:
          result
            .outcomeProbabilities
            .home,

        draw:
          result
            .outcomeProbabilities
            .draw,

        away:
          result
            .outcomeProbabilities
            .away,
      };

      const actual =
        determineActualOutcome(
          match.homeScore,
          match.awayScore,
        );

      const baselinePrediction =
        determineArgmax(
          probabilities,
        );

      updateAggregate(
        baseline,
        actual,
        baselinePrediction,
      );

      for (
        const config
        of configurations
      ) {
        const key =
          [
            config
              .minimumDrawProbability,

            config
              .maximumDrawGap,
          ].join(
            ":",
          );

        const aggregate =
          aggregates.get(
            key,
          );

        if (
          !aggregate
        ) {
          continue;
        }

        const predicted =
          determineWithDrawLayer(
            probabilities,
            config,
          );

        updateAggregate(
          aggregate,
          actual,
          predicted,
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
          `VALIDATION ${processed}/${validation.length}`,
        );
      }
    } catch (
      error: unknown
    ) {
      failed +=
        1;

      console.error(
        [
          "FAILED",
          match.id,
          `${match.homeTeam.name} - ${match.awayTeam.name}`,
        ].join(
          " • ",
        ),
      );

      console.error(
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "BASELINE POISSON",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Matches:
      baseline.matches,

    Accuracy:
      percentage(
        baseline.correct,
        baseline.matches,
      ),

    "HOME Recall":
      percentage(
        baseline.homeCorrect,
        baseline.homeActual,
      ),

    "DRAW Actual":
      baseline.drawActual,

    "DRAW Predicted":
      baseline.drawPredicted,

    "DRAW Correct":
      baseline.drawCorrect,

    "DRAW Recall":
      percentage(
        baseline.drawCorrect,
        baseline.drawActual,
      ),

    "DRAW Precision":
      percentage(
        baseline.drawCorrect,
        baseline.drawPredicted,
      ),

    "AWAY Recall":
      percentage(
        baseline.awayCorrect,
        baseline.awayActual,
      ),

    Failed:
      failed,
  });

  const resultRows =
    configurations.map(
      (
        config,
      ) => {
        const key =
          [
            config
              .minimumDrawProbability,

            config
              .maximumDrawGap,
          ].join(
            ":",
          );

        const aggregate =
          aggregates.get(
            key,
          )!;

        return {
          minimumDrawProbability:
            config
              .minimumDrawProbability,

          maximumDrawGap:
            config
              .maximumDrawGap,

          accuracy:
            percentage(
              aggregate.correct,
              aggregate.matches,
            ),

          homeRecall:
            percentage(
              aggregate.homeCorrect,
              aggregate.homeActual,
            ),

          drawRecall:
            percentage(
              aggregate.drawCorrect,
              aggregate.drawActual,
            ),

          drawPrecision:
            percentage(
              aggregate.drawCorrect,
              aggregate.drawPredicted,
            ),

          awayRecall:
            percentage(
              aggregate.awayCorrect,
              aggregate.awayActual,
            ),

          predictedHome:
            aggregate.homePredicted,

          predictedDraw:
            aggregate.drawPredicted,

          drawCorrect:
            aggregate.drawCorrect,

          predictedAway:
            aggregate.awayPredicted,

          score:
            calculateScore(
              aggregate,
            ),
        };
      },
    );

  const ranked =
    [
      ...resultRows,
    ].sort(
      (
        first,
        second,
      ) =>
        second.score -
        first.score,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TOP 30 DRAW DECISION RULES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    ranked.slice(
      0,
      30,
    ),
  );

  /*
   * Minimum kalite eşiği.
   *
   * Amacımız DRAW recall kazanırken
   * genel accuracy'yi fazla bozmamak.
   */
  const candidates =
    ranked.filter(
      (
        row,
      ) =>
        row.accuracy >=
          49 &&
        row.drawRecall >=
          10 &&
        row.drawPrecision >=
          25 &&
        row.homeRecall >=
          65 &&
        row.awayRecall >=
          35 &&
        row.predictedDraw >=
          40,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRACTICAL CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  if (
    candidates.length ===
    0
  ) {
    console.log(
      "Pratik DRAW decision adayı bulunamadı.",
    );
  } else {
    console.table(
      candidates.slice(
        0,
        20,
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW DECISION LAYER V1 TAMAMLANDI.",
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
        "DRAW Decision Layer testi başarısız.",
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