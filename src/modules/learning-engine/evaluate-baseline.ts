import type {
  BaselineEvaluationMetrics,
  BaselineEvaluationResult,
  ChronologicalTrainingSplit,
  MatchOutcome,
  OutcomePerformance,
  OutcomeProbability,
} from "./types";

const MINIMUM_PROBABILITY = 1e-15;

function round(
  value: number,
  decimals = 6,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function classToOutcome(
  value: number,
): MatchOutcome {
  switch (value) {
    case 0:
      return "HOME";

    case 1:
      return "DRAW";

    case 2:
      return "AWAY";

    default:
      throw new Error(
        `Bilinmeyen outcome sınıfı: ${value}`,
      );
  }
}

function outcomeToIndex(
  outcome: MatchOutcome,
): number {
  switch (outcome) {
    case "HOME":
      return 0;

    case "DRAW":
      return 1;

    case "AWAY":
      return 2;
  }
}

function selectPredictedOutcome(
  probabilities: OutcomeProbability,
): MatchOutcome {
  const candidates: Array<{
    outcome: MatchOutcome;
    probability: number;
  }> = [
    {
      outcome: "HOME",
      probability: probabilities.home,
    },
    {
      outcome: "DRAW",
      probability: probabilities.draw,
    },
    {
      outcome: "AWAY",
      probability: probabilities.away,
    },
  ];

  candidates.sort(
    (left, right) =>
      right.probability -
      left.probability,
  );

  return candidates[0].outcome;
}

function calculateBrierScore(options: {
  actualOutcomes: MatchOutcome[];
  probabilities: OutcomeProbability;
}): number {
  if (
    options.actualOutcomes.length === 0
  ) {
    throw new Error(
      "Brier Score için en az bir sonuç gereklidir.",
    );
  }

  const probabilityVector = [
    options.probabilities.home,
    options.probabilities.draw,
    options.probabilities.away,
  ];

  let totalScore = 0;

  for (
    const actualOutcome
    of options.actualOutcomes
  ) {
    const actualIndex =
      outcomeToIndex(actualOutcome);

    let matchScore = 0;

    for (
      let index = 0;
      index < probabilityVector.length;
      index += 1
    ) {
      const actualValue =
        index === actualIndex
          ? 1
          : 0;

      const error =
        probabilityVector[index] -
        actualValue;

      matchScore += error ** 2;
    }

    totalScore += matchScore;
  }

  return round(
    totalScore /
      options.actualOutcomes.length,
  );
}

function calculateLogLoss(options: {
  actualOutcomes: MatchOutcome[];
  probabilities: OutcomeProbability;
}): number {
  if (
    options.actualOutcomes.length === 0
  ) {
    throw new Error(
      "Log Loss için en az bir sonuç gereklidir.",
    );
  }

  const probabilityVector = [
    options.probabilities.home,
    options.probabilities.draw,
    options.probabilities.away,
  ];

  let totalLoss = 0;

  for (
    const actualOutcome
    of options.actualOutcomes
  ) {
    const actualIndex =
      outcomeToIndex(actualOutcome);

    const probability = Math.max(
      probabilityVector[actualIndex],
      MINIMUM_PROBABILITY,
    );

    totalLoss += -Math.log(probability);
  }

  return round(
    totalLoss /
      options.actualOutcomes.length,
  );
}

function calculateOutcomePerformance(options: {
  actualOutcomes: MatchOutcome[];
  predictedOutcomes: MatchOutcome[];
}): OutcomePerformance[] {
  const outcomes: MatchOutcome[] = [
    "HOME",
    "DRAW",
    "AWAY",
  ];

  return outcomes.map((outcome) => {
    const actualCount =
      options.actualOutcomes.filter(
        (value) => value === outcome,
      ).length;

    const predictedCount =
      options.predictedOutcomes.filter(
        (value) => value === outcome,
      ).length;

    const correctCount =
      options.actualOutcomes.reduce(
        (count, actual, index) => {
          const predicted =
            options.predictedOutcomes[
              index
            ];

          return (
            count +
            Number(
              actual === outcome &&
                predicted === outcome,
            )
          );
        },
        0,
      );

    const recallPercentage =
      actualCount > 0
        ? round(
            (correctCount /
              actualCount) *
              100,
            2,
          )
        : null;

    const precisionPercentage =
      predictedCount > 0
        ? round(
            (correctCount /
              predictedCount) *
              100,
            2,
          )
        : null;

    return {
      outcome,
      actualCount,
      predictedCount,
      correctCount,
      recallPercentage,
      precisionPercentage,
    };
  });
}

function evaluateValidation(options: {
  actualOutcomes: MatchOutcome[];
  probabilities: OutcomeProbability;
}): BaselineEvaluationMetrics {
  const predictedOutcome =
    selectPredictedOutcome(
      options.probabilities,
    );

  const predictedOutcomes =
    options.actualOutcomes.map(
      () => predictedOutcome,
    );

  const correctPredictionCount =
    options.actualOutcomes.filter(
      (actualOutcome) =>
        actualOutcome ===
        predictedOutcome,
    ).length;

  const evaluatedMatchCount =
    options.actualOutcomes.length;

  return {
    evaluatedMatchCount,

    correctPredictionCount,

    incorrectPredictionCount:
      evaluatedMatchCount -
      correctPredictionCount,

    accuracyPercentage:
      round(
        (correctPredictionCount /
          evaluatedMatchCount) *
          100,
        2,
      ),

    brierScore:
      calculateBrierScore({
        actualOutcomes:
          options.actualOutcomes,

        probabilities:
          options.probabilities,
      }),

    logLoss:
      calculateLogLoss({
        actualOutcomes:
          options.actualOutcomes,

        probabilities:
          options.probabilities,
      }),

    predictedProbabilities:
      options.probabilities,

    predictedOutcome,

    outcomePerformance:
      calculateOutcomePerformance({
        actualOutcomes:
          options.actualOutcomes,

        predictedOutcomes,
      }),
  };
}

export function evaluateBaselineModel(
  split: ChronologicalTrainingSplit,
): BaselineEvaluationResult {
  if (
    split.training.rowCount === 0 ||
    split.validation.rowCount === 0
  ) {
    throw new Error(
      "Baseline değerlendirmesi için training ve validation satırları gereklidir.",
    );
  }

  const trainingOutcomes =
    split.training.yClass.map(
      classToOutcome,
    );

  const validationOutcomes =
    split.validation.yClass.map(
      classToOutcome,
    );

  const homeCount =
    trainingOutcomes.filter(
      (outcome) =>
        outcome === "HOME",
    ).length;

  const drawCount =
    trainingOutcomes.filter(
      (outcome) =>
        outcome === "DRAW",
    ).length;

  const awayCount =
    trainingOutcomes.filter(
      (outcome) =>
        outcome === "AWAY",
    ).length;

  const totalTrainingCount =
    trainingOutcomes.length;

  const probabilities: OutcomeProbability =
    {
      home:
        homeCount /
        totalTrainingCount,

      draw:
        drawCount /
        totalTrainingCount,

      away:
        awayCount /
        totalTrainingCount,
    };

  const warnings: string[] = [];

  const lowestProbability =
    Math.min(
      probabilities.home,
      probabilities.draw,
      probabilities.away,
    );

  if (lowestProbability === 0) {
    warnings.push(
      "Training bölümünde sonuç sınıflarından en az biri hiç bulunmuyor.",
    );
  }

  if (
    split.validation.rowCount < 80
  ) {
    warnings.push(
      [
        "Validation örnek sayısı düşük:",
        split.validation.rowCount,
        "Sonuçların güven aralığı geniş olabilir.",
      ].join(" "),
    );
  }

  const leakageCount =
    split.validation.metadata.filter(
      (row) =>
        row
          .containsPostMatchCalculatedFeatures,
    ).length;

  if (leakageCount > 0) {
    warnings.push(
      [
        leakageCount,
        "validation maçında maç sonrası feature riski bulunuyor.",
        "Sonuç EXPERIMENTAL kabul edilmelidir.",
      ].join(" "),
    );
  }

  return {
    trainingRowCount:
      split.training.rowCount,

    validationRowCount:
      split.validation.rowCount,

    trainingOutcomeDistribution: {
      homeCount,
      drawCount,
      awayCount,

      homePercentage:
        round(
          probabilities.home * 100,
          2,
        ),

      drawPercentage:
        round(
          probabilities.draw * 100,
          2,
        ),

      awayPercentage:
        round(
          probabilities.away * 100,
          2,
        ),
    },

    validationMetrics:
      evaluateValidation({
        actualOutcomes:
          validationOutcomes,

        probabilities,
      }),

    warnings,
  };
}