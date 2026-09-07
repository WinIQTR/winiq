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

type MatchEvaluationRow = {
  matchId: number;

  kickoffAt: Date;

  leagueApiId: number;
  leagueName: string;

  homeTeam: string;
  awayTeam: string;

  actualOutcome: Outcome;

  probabilities:
    Probabilities;
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

  brierTotal: number;
  logLossTotal: number;
};

type EvaluationResult = {
  configuration:
    DrawDecisionConfig | null;

  matches: number;

  accuracy: number;

  homeRecall: number;

  drawRecall: number;
  drawPrecision: number;

  awayRecall: number;

  actualHome: number;
  predictedHome: number;

  actualDraw: number;
  predictedDraw: number;
  drawCorrect: number;

  actualAway: number;
  predictedAway: number;

  brier: number;
  logLoss: number;

  score: number;
};

const SEASON_YEAR =
  2024;

const TRAIN_PERCENTAGE =
  60;

const VALIDATION_PERCENTAGE =
  20;

const TEST_PERCENTAGE =
  20;

const MIN_PROBABILITY =
  1e-15;

/*
 * V1 sonucunun çevresinde daha hassas
 * threshold taraması.
 */
const MINIMUM_DRAW_PROBABILITIES = [
  23,
  24,
  25,
  26,
  27,
  28,
] as const;

const MAXIMUM_DRAW_GAPS = [
  12,
  13,
  14,
  15,
  16,
  17,
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

  configuration:
    DrawDecisionConfig,
): Outcome {
  const baselineOutcome =
    determineArgmax(
      probabilities,
    );

  if (
    baselineOutcome ===
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

  if (
    probabilities.draw >=
      configuration
        .minimumDrawProbability &&
    drawGap <=
      configuration
        .maximumDrawGap
  ) {
    return "DRAW";
  }

  return baselineOutcome;
}

function probabilityForOutcome(
  probabilities:
    Probabilities,

  outcome:
    Outcome,
): number {
  switch (
    outcome
  ) {
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
  actualOutcome:
    Outcome,

  probabilities:
    Probabilities,
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
  actualOutcome:
    Outcome,

  probabilities:
    Probabilities,
): number {
  const probability =
    probabilityForOutcome(
      probabilities,
      actualOutcome,
    );

  return (
    -Math.log(
      Math.max(
        probability,
        MIN_PROBABILITY,
      ),
    )
  );
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

    brierTotal:
      0,

    logLossTotal:
      0,
  };
}

function updateAggregate(
  aggregate:
    Aggregate,

  actualOutcome:
    Outcome,

  predictedOutcome:
    Outcome,

  probabilities:
    Probabilities,
): void {
  aggregate.matches +=
    1;

  if (
    actualOutcome ===
    "HOME"
  ) {
    aggregate.homeActual +=
      1;
  } else if (
    actualOutcome ===
    "DRAW"
  ) {
    aggregate.drawActual +=
      1;
  } else {
    aggregate.awayActual +=
      1;
  }

  if (
    predictedOutcome ===
    "HOME"
  ) {
    aggregate.homePredicted +=
      1;
  } else if (
    predictedOutcome ===
    "DRAW"
  ) {
    aggregate.drawPredicted +=
      1;
  } else {
    aggregate.awayPredicted +=
      1;
  }

  if (
    actualOutcome ===
    predictedOutcome
  ) {
    aggregate.correct +=
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
   * Decision Layer sadece sınıf kararını
   * değiştiriyor.
   *
   * Poisson probability dağılımı
   * değiştirilmediği için Brier / Log Loss
   * aynı olasılıklar üzerinden hesaplanır.
   */
  aggregate.brierTotal +=
    calculateBrier(
      actualOutcome,
      probabilities,
    );

  aggregate.logLossTotal +=
    calculateLogLoss(
      actualOutcome,
      probabilities,
    );
}

function calculateSelectionScore(
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
   * Birkaç DRAW tahmini yapıp
   * tesadüfen yüksek precision almanın
   * ranking'i bozmasını engelliyoruz.
   */
  const drawSampleFactor =
    Math.min(
      aggregate.drawPredicted /
        80,
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

function createEvaluationResult(
  aggregate:
    Aggregate,

  configuration:
    DrawDecisionConfig | null,
): EvaluationResult {
  return {
    configuration,

    matches:
      aggregate.matches,

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

    actualHome:
      aggregate.homeActual,

    predictedHome:
      aggregate.homePredicted,

    actualDraw:
      aggregate.drawActual,

    predictedDraw:
      aggregate.drawPredicted,

    drawCorrect:
      aggregate.drawCorrect,

    actualAway:
      aggregate.awayActual,

    predictedAway:
      aggregate.awayPredicted,

    brier:
      aggregate.matches >
      0
        ? round(
            aggregate.brierTotal /
              aggregate.matches,
            6,
          )
        : 0,

    logLoss:
      aggregate.matches >
      0
        ? round(
            aggregate.logLossTotal /
              aggregate.matches,
            6,
          )
        : 0,

    score:
      calculateSelectionScore(
        aggregate,
      ),
  };
}

function evaluateBaseline(
  rows:
    MatchEvaluationRow[],
): EvaluationResult {
  const aggregate =
    createAggregate();

  for (
    const row
    of rows
  ) {
    const prediction =
      determineArgmax(
        row.probabilities,
      );

    updateAggregate(
      aggregate,
      row.actualOutcome,
      prediction,
      row.probabilities,
    );
  }

  return createEvaluationResult(
    aggregate,
    null,
  );
}

function evaluateConfiguration(
  rows:
    MatchEvaluationRow[],

  configuration:
    DrawDecisionConfig,
): EvaluationResult {
  const aggregate =
    createAggregate();

  for (
    const row
    of rows
  ) {
    const prediction =
      determineWithDrawLayer(
        row.probabilities,
        configuration,
      );

    updateAggregate(
      aggregate,
      row.actualOutcome,
      prediction,
      row.probabilities,
    );
  }

  return createEvaluationResult(
    aggregate,
    configuration,
  );
}

function isPracticalValidationCandidate(
  result:
    EvaluationResult,
): boolean {
  return (
    result.accuracy >=
      49 &&
    result.drawRecall >=
      10 &&
    result.drawPrecision >=
      25 &&
    result.homeRecall >=
      65 &&
    result.awayRecall >=
      35 &&
    result.predictedDraw >=
      30
  );
}

async function buildEvaluationRows(
  matches:
    Array<{
      id: number;

      kickoffAt: Date;

      homeScore:
        number | null;

      awayScore:
        number | null;

      homeTeam: {
        name: string;
      };

      awayTeam: {
        name: string;
      };

      season: {
        league: {
          apiId: number;
          name: string;
        };
      };
    }>,

  phase:
    string,
): Promise<{
  rows:
    MatchEvaluationRow[];

  failed:
    number;
}> {
  const rows:
    MatchEvaluationRow[] =
      [];

  let failed =
    0;

  for (
    let index = 0;
    index <
    matches.length;
    index +=
      1
  ) {
    const match =
      matches[
        index
      ];

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

        actualOutcome:
          determineActualOutcome(
            match.homeScore,
            match.awayScore,
          ),

        probabilities: {
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
        },
      });

      if (
        (
          index +
          1
        ) %
          100 ===
        0
      ) {
        console.log(
          `${phase} ${index + 1}/${matches.length}`,
        );
      }
    } catch (
      error: unknown
    ) {
      failed +=
        1;

      console.error(
        [
          `${phase} FAILED`,
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

  return {
    rows,
    failed,
  };
}

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW DECISION HOLDOUT V2",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Sezon:
      SEASON_YEAR,

    Organizasyon:
      ACTIVE_COMPETITIONS.length,

    Train:
      `${TRAIN_PERCENTAGE}%`,

    Validation:
      `${VALIDATION_PERCENTAGE}%`,

    Test:
      `${TEST_PERCENTAGE}%`,

    "Threshold kombinasyonu":
      MINIMUM_DRAW_PROBABILITIES.length *
      MAXIMUM_DRAW_GAPS.length,
  });

  const percentageTotal =
    TRAIN_PERCENTAGE +
    VALIDATION_PERCENTAGE +
    TEST_PERCENTAGE;

  if (
    percentageTotal !==
    100
  ) {
    throw new Error(
      `Dataset split toplamı 100 olmalıdır. Gelen: ${percentageTotal}`,
    );
  }

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

  if (
    matches.length <
    1000
  ) {
    throw new Error(
      `Historical dataset yetersiz: ${matches.length}`,
    );
  }

  const trainEndIndex =
    Math.floor(
      matches.length *
        (
          TRAIN_PERCENTAGE /
          100
        ),
    );

  const validationEndIndex =
    Math.floor(
      matches.length *
        (
          (
            TRAIN_PERCENTAGE +
            VALIDATION_PERCENTAGE
          ) /
          100
        ),
    );

  const trainMatches =
    matches.slice(
      0,
      trainEndIndex,
    );

  const validationMatches =
    matches.slice(
      trainEndIndex,
      validationEndIndex,
    );

  const testMatches =
    matches.slice(
      validationEndIndex,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "CHRONOLOGICAL SPLIT",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "All matches":
      matches.length,

    "Train matches":
      trainMatches.length,

    "Validation matches":
      validationMatches.length,

    "Test matches":
      testMatches.length,

    "Train start":
      trainMatches[
        0
      ]?.kickoffAt
        .toISOString(),

    "Train end":
      trainMatches[
        trainMatches.length -
        1
      ]?.kickoffAt
        .toISOString(),

    "Validation start":
      validationMatches[
        0
      ]?.kickoffAt
        .toISOString(),

    "Validation end":
      validationMatches[
        validationMatches.length -
        1
      ]?.kickoffAt
        .toISOString(),

    "Test start":
      testMatches[
        0
      ]?.kickoffAt
        .toISOString(),

    "Test end":
      testMatches[
        testMatches.length -
        1
      ]?.kickoffAt
        .toISOString(),
  });

  /*
   * TRAIN seti burada threshold seçmek için
   * kullanılmıyor.
   *
   * Poisson motoru her maç için zaten yalnızca
   * kickoff öncesindeki geçmiş veriyi kullanıyor.
   *
   * TRAIN bölümü gelecekte model parametre
   * optimizasyonunda kullanılabilmesi için
   * kronolojik olarak ayrılmış durumda.
   */

  console.log("");
  console.log(
    "Validation Poisson sonuçları hesaplanıyor...",
  );

  const validationData =
    await buildEvaluationRows(
      validationMatches,
      "VALIDATION",
    );

  console.log("");
  console.table({
    "Validation expected":
      validationMatches.length,

    "Validation processed":
      validationData
        .rows
        .length,

    "Validation failed":
      validationData.failed,
  });

  const validationBaseline =
    evaluateBaseline(
      validationData.rows,
    );

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

  const validationResults =
    configurations.map(
      (
        configuration,
      ) =>
        evaluateConfiguration(
          validationData.rows,
          configuration,
        ),
    );

  const rankedValidation =
    [
      ...validationResults,
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
    "VALIDATION BASELINE",
  );

  console.log(
    "==============================================",
  );

  console.table({
    Matches:
      validationBaseline.matches,

    Accuracy:
      validationBaseline.accuracy,

    "HOME Recall":
      validationBaseline.homeRecall,

    "DRAW Actual":
      validationBaseline.actualDraw,

    "DRAW Predicted":
      validationBaseline.predictedDraw,

    "DRAW Correct":
      validationBaseline.drawCorrect,

    "DRAW Recall":
      validationBaseline.drawRecall,

    "DRAW Precision":
      validationBaseline.drawPrecision,

    "AWAY Recall":
      validationBaseline.awayRecall,

    Brier:
      validationBaseline.brier,

    "Log Loss":
      validationBaseline.logLoss,
  });

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TOP VALIDATION RULES",
  );

  console.log(
    "==============================================",
  );

  console.table(
    rankedValidation
      .slice(
        0,
        20,
      )
      .map(
        (
          result,
          index,
        ) => ({
          rank:
            index +
            1,

          minDraw:
            result
              .configuration
              ?.minimumDrawProbability,

          maxGap:
            result
              .configuration
              ?.maximumDrawGap,

          accuracy:
            result.accuracy,

          homeRecall:
            result.homeRecall,

          drawRecall:
            result.drawRecall,

          drawPrecision:
            result.drawPrecision,

          awayRecall:
            result.awayRecall,

          predictedDraw:
            result.predictedDraw,

          drawCorrect:
            result.drawCorrect,

          score:
            result.score,
        }),
      ),
  );

  const practicalValidationCandidates =
    rankedValidation.filter(
      isPracticalValidationCandidate,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "VALIDATION PRACTICAL CANDIDATES",
  );

  console.log(
    "==============================================",
  );

  if (
    practicalValidationCandidates.length ===
    0
  ) {
    console.log(
      "Pratik validation adayı bulunamadı.",
    );

    console.log(
      "En yüksek validation score kullanılacak.",
    );
  } else {
    console.table(
      practicalValidationCandidates
        .slice(
          0,
          15,
        )
        .map(
          (
            result,
            index,
          ) => ({
            rank:
              index +
              1,

            minDraw:
              result
                .configuration
                ?.minimumDrawProbability,

            maxGap:
              result
                .configuration
                ?.maximumDrawGap,

            accuracy:
              result.accuracy,

            drawRecall:
              result.drawRecall,

            drawPrecision:
              result.drawPrecision,

            homeRecall:
              result.homeRecall,

            awayRecall:
              result.awayRecall,

            predictedDraw:
              result.predictedDraw,

            score:
              result.score,
          }),
        ),
    );
  }

  const selectedValidationResult =
    practicalValidationCandidates[
      0
    ] ??
    rankedValidation[
      0
    ];

  const selectedConfiguration =
    selectedValidationResult
      .configuration;

  if (
    !selectedConfiguration
  ) {
    throw new Error(
      "Validation sonucundan DRAW configuration seçilemedi.",
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "SELECTED RULE — VALIDATION ONLY",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Minimum DRAW probability":
      selectedConfiguration
        .minimumDrawProbability,

    "Maximum DRAW gap":
      selectedConfiguration
        .maximumDrawGap,

    "Validation accuracy":
      selectedValidationResult
        .accuracy,

    "Validation DRAW recall":
      selectedValidationResult
        .drawRecall,

    "Validation DRAW precision":
      selectedValidationResult
        .drawPrecision,

    "Validation HOME recall":
      selectedValidationResult
        .homeRecall,

    "Validation AWAY recall":
      selectedValidationResult
        .awayRecall,

    "Validation predicted DRAW":
      selectedValidationResult
        .predictedDraw,

    "Validation score":
      selectedValidationResult
        .score,
  });

  /*
   * ==================================================
   * FINAL TEST
   * ==================================================
   *
   * Bundan önce test setindeki hiçbir sonuç
   * threshold seçiminde kullanılmadı.
   */

  console.log("");
  console.log(
    "Test Poisson sonuçları hesaplanıyor...",
  );

  const testData =
    await buildEvaluationRows(
      testMatches,
      "TEST",
    );

  console.log("");
  console.table({
    "Test expected":
      testMatches.length,

    "Test processed":
      testData
        .rows
        .length,

    "Test failed":
      testData.failed,
  });

  const testBaseline =
    evaluateBaseline(
      testData.rows,
    );

  const testDecisionLayer =
    evaluateConfiguration(
      testData.rows,
      selectedConfiguration,
    );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "FINAL INDEPENDENT TEST",
  );

  console.log(
    "==============================================",
  );

  console.table([
    {
      model:
        "POISSON BASELINE",

      minDraw:
        "-",

      maxGap:
        "-",

      matches:
        testBaseline.matches,

      accuracy:
        testBaseline.accuracy,

      homeRecall:
        testBaseline.homeRecall,

      drawRecall:
        testBaseline.drawRecall,

      drawPrecision:
        testBaseline.drawPrecision,

      awayRecall:
        testBaseline.awayRecall,

      predictedDraw:
        testBaseline.predictedDraw,

      drawCorrect:
        testBaseline.drawCorrect,

      brier:
        testBaseline.brier,

      logLoss:
        testBaseline.logLoss,
    },

    {
      model:
        "POISSON + DRAW LAYER",

      minDraw:
        selectedConfiguration
          .minimumDrawProbability,

      maxGap:
        selectedConfiguration
          .maximumDrawGap,

      matches:
        testDecisionLayer.matches,

      accuracy:
        testDecisionLayer.accuracy,

      homeRecall:
        testDecisionLayer.homeRecall,

      drawRecall:
        testDecisionLayer.drawRecall,

      drawPrecision:
        testDecisionLayer.drawPrecision,

      awayRecall:
        testDecisionLayer.awayRecall,

      predictedDraw:
        testDecisionLayer.predictedDraw,

      drawCorrect:
        testDecisionLayer.drawCorrect,

      /*
       * Olasılık dağılımı değişmediği için
       * bunların baseline ile aynı olması
       * beklenir.
       */
      brier:
        testDecisionLayer.brier,

      logLoss:
        testDecisionLayer.logLoss,
    },
  ]);

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "TEST DELTA",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Accuracy delta":
      round(
        testDecisionLayer.accuracy -
        testBaseline.accuracy,
        2,
      ),

    "HOME recall delta":
      round(
        testDecisionLayer.homeRecall -
        testBaseline.homeRecall,
        2,
      ),

    "DRAW recall delta":
      round(
        testDecisionLayer.drawRecall -
        testBaseline.drawRecall,
        2,
      ),

    "DRAW precision delta":
      round(
        testDecisionLayer.drawPrecision -
        testBaseline.drawPrecision,
        2,
      ),

    "AWAY recall delta":
      round(
        testDecisionLayer.awayRecall -
        testBaseline.awayRecall,
        2,
      ),

    "Ek DRAW tahmini":
      testDecisionLayer.predictedDraw -
      testBaseline.predictedDraw,

    "Ek doğru DRAW":
      testDecisionLayer.drawCorrect -
      testBaseline.drawCorrect,
  });

  /*
   * ==================================================
   * PRODUCTION GATE
   * ==================================================
   */

  const accuracyLoss =
    testBaseline.accuracy -
    testDecisionLayer.accuracy;

  const passesProductionGate =
    testDecisionLayer.accuracy >=
      50 &&
    accuracyLoss <=
      2 &&
    testDecisionLayer.drawRecall >=
      12 &&
    testDecisionLayer.drawPrecision >=
      27 &&
    testDecisionLayer.homeRecall >=
      65 &&
    testDecisionLayer.awayRecall >=
      35 &&
    testDecisionLayer.predictedDraw >=
      30;

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "PRODUCTION GATE",
  );

  console.log(
    "==============================================",
  );

  console.table({
    "Accuracy >= 50":
      testDecisionLayer.accuracy >=
      50,

    "Accuracy loss <= 2":
      accuracyLoss <=
      2,

    "DRAW Recall >= 12":
      testDecisionLayer.drawRecall >=
      12,

    "DRAW Precision >= 27":
      testDecisionLayer.drawPrecision >=
      27,

    "HOME Recall >= 65":
      testDecisionLayer.homeRecall >=
      65,

    "AWAY Recall >= 35":
      testDecisionLayer.awayRecall >=
      35,

    "Predicted DRAW >= 30":
      testDecisionLayer.predictedDraw >=
      30,

    "FINAL STATUS":
      passesProductionGate
        ? "PASS"
        : "FAIL",
  });

  console.log("");

  if (
    passesProductionGate
  ) {
    console.log(
      [
        "SONUÇ:",
        "Poisson + DRAW Decision Layer",
        "bağımsız test setinde production gate'i geçti.",
      ].join(
        " ",
      ),
    );
  } else {
    console.log(
      [
        "SONUÇ:",
        "DRAW Decision Layer bağımsız testte",
        "production koşullarının tamamını geçemedi.",
      ].join(
        " ",
      ),
    );
  }

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "DRAW DECISION HOLDOUT V2 TAMAMLANDI.",
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
        "DRAW Decision Holdout V2 testi başarısız.",
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