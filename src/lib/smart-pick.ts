import {
  evaluatePredictions,
  type EvaluatedPrediction,
} from "@/lib/prediction-evaluation";

export type SmartPickRule = {
  minimumProbability: number;
  minimumConfidence: number;

  sampleSize: number;
  correctPredictions: number;

  accuracy: number;
  coveragePercentage: number;

  score: number;
};

export type SmartPickValidation = {
  sampleSize: number;
  correctPredictions: number;
  incorrectPredictions: number;

  accuracy: number;
  coveragePercentage: number;

  baselineAccuracy: number;
  improvementVsBaseline: number;
};

export type SmartPickReport = {
  totalEvaluatedPredictions: number;

  trainingPredictionCount: number;
  validationPredictionCount: number;

  trainingBaselineAccuracy: number;
  validationBaselineAccuracy: number;

  rule: SmartPickRule | null;

  validation: SmartPickValidation | null;

  trainingPicks: EvaluatedPrediction[];
  validationPicks: EvaluatedPrediction[];

  testedRules: SmartPickRule[];
};

const PROBABILITY_THRESHOLDS = [
  40,
  45,
  50,
  55,
  60,
  65,
];

const CONFIDENCE_THRESHOLDS = [
  0,
  50,
  60,
  70,
  80,
];

const TRAINING_RATIO = 0.6;

const MINIMUM_TRAINING_SAMPLE_SIZE = 20;

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (denominator <= 0) {
    return 0;
  }

  return round(
    (
      numerator /
      denominator
    ) * 100,
  );
}

function countCorrect(
  predictions: EvaluatedPrediction[],
): number {
  return predictions.filter(
    (prediction) =>
      prediction.isCorrect,
  ).length;
}

function calculateAccuracy(
  predictions: EvaluatedPrediction[],
): number {
  return percentage(
    countCorrect(predictions),
    predictions.length,
  );
}

function matchesRule(
  prediction: EvaluatedPrediction,
  minimumProbability: number,
  minimumConfidence: number,
): boolean {
  return (
    prediction.predictedProbability >=
      minimumProbability &&
    prediction.confidenceScore >=
      minimumConfidence
  );
}

function calculateRuleScore(options: {
  accuracy: number;
  coveragePercentage: number;
  sampleSize: number;
}): number {
  /*
   * Doğruluk ana kriter.
   *
   * Coverage ve örneklem büyüklüğü,
   * küçük grupların tesadüfen çok yüksek
   * doğrulukla öne çıkmasını azaltır.
   */
  const sampleStrength =
    Math.min(
      options.sampleSize / 50,
      1,
    ) * 100;

  return round(
    options.accuracy * 0.7 +
      options.coveragePercentage * 0.15 +
      sampleStrength * 0.15,
    4,
  );
}

function buildRule(options: {
  predictions: EvaluatedPrediction[];

  minimumProbability: number;
  minimumConfidence: number;
}): SmartPickRule | null {
  const picks =
    options.predictions.filter(
      (prediction) =>
        matchesRule(
          prediction,
          options.minimumProbability,
          options.minimumConfidence,
        ),
    );

  if (
    picks.length <
    MINIMUM_TRAINING_SAMPLE_SIZE
  ) {
    return null;
  }

  const correctPredictions =
    countCorrect(picks);

  const accuracy =
    percentage(
      correctPredictions,
      picks.length,
    );

  const coveragePercentage =
    percentage(
      picks.length,
      options.predictions.length,
    );

  const score =
    calculateRuleScore({
      accuracy,
      coveragePercentage,
      sampleSize:
        picks.length,
    });

  return {
    minimumProbability:
      options.minimumProbability,

    minimumConfidence:
      options.minimumConfidence,

    sampleSize:
      picks.length,

    correctPredictions,

    accuracy,

    coveragePercentage,

    score,
  };
}

function selectBestRule(
  rules: SmartPickRule[],
): SmartPickRule | null {
  if (rules.length === 0) {
    return null;
  }

  return [...rules].sort(
    (first, second) => {
      if (
        second.score !==
        first.score
      ) {
        return (
          second.score -
          first.score
        );
      }

      if (
        second.accuracy !==
        first.accuracy
      ) {
        return (
          second.accuracy -
          first.accuracy
        );
      }

      return (
        second.sampleSize -
        first.sampleSize
      );
    },
  )[0];
}

function splitChronologically(
  predictions: EvaluatedPrediction[],
): {
  training: EvaluatedPrediction[];
  validation: EvaluatedPrediction[];
} {
  const sorted =
    [...predictions].sort(
      (first, second) =>
        first.kickoffAt.getTime() -
        second.kickoffAt.getTime(),
    );

  if (sorted.length < 2) {
    return {
      training: sorted,
      validation: [],
    };
  }

  const rawSplitIndex =
    Math.floor(
      sorted.length *
        TRAINING_RATIO,
    );

  const splitIndex =
    Math.min(
      Math.max(
        rawSplitIndex,
        1,
      ),
      sorted.length - 1,
    );

  return {
    training:
      sorted.slice(
        0,
        splitIndex,
      ),

    validation:
      sorted.slice(
        splitIndex,
      ),
  };
}

function validateRule(options: {
  rule: SmartPickRule;

  validationPredictions:
    EvaluatedPrediction[];
}): {
  validation: SmartPickValidation;
  picks: EvaluatedPrediction[];
} {
  const picks =
    options.validationPredictions.filter(
      (prediction) =>
        matchesRule(
          prediction,
          options.rule
            .minimumProbability,
          options.rule
            .minimumConfidence,
        ),
    );

  const correctPredictions =
    countCorrect(picks);

  const accuracy =
    calculateAccuracy(picks);

  const baselineAccuracy =
    calculateAccuracy(
      options.validationPredictions,
    );

  const coveragePercentage =
    percentage(
      picks.length,
      options.validationPredictions
        .length,
    );

  return {
    validation: {
      sampleSize:
        picks.length,

      correctPredictions,

      incorrectPredictions:
        picks.length -
        correctPredictions,

      accuracy,

      coveragePercentage,

      baselineAccuracy,

      improvementVsBaseline:
        round(
          accuracy -
            baselineAccuracy,
        ),
    },

    picks,
  };
}

export async function buildSmartPickReport(
  limit = 200,
): Promise<SmartPickReport> {
  const evaluation =
    await evaluatePredictions(
      limit,
    );

  const predictions =
    evaluation.predictions;

  if (
    predictions.length === 0
  ) {
    return {
      totalEvaluatedPredictions: 0,

      trainingPredictionCount: 0,
      validationPredictionCount: 0,

      trainingBaselineAccuracy: 0,
      validationBaselineAccuracy: 0,

      rule: null,
      validation: null,

      trainingPicks: [],
      validationPicks: [],

      testedRules: [],
    };
  }

  const {
    training,
    validation,
  } =
    splitChronologically(
      predictions,
    );

  const testedRules:
    SmartPickRule[] = [];

  for (
    const minimumProbability
    of PROBABILITY_THRESHOLDS
  ) {
    for (
      const minimumConfidence
      of CONFIDENCE_THRESHOLDS
    ) {
      const rule =
        buildRule({
          predictions:
            training,

          minimumProbability,

          minimumConfidence,
        });

      if (rule) {
        testedRules.push(
          rule,
        );
      }
    }
  }

  const sortedRules =
    [...testedRules].sort(
      (first, second) =>
        second.score -
        first.score,
    );

  const rule =
    selectBestRule(
      sortedRules,
    );

  if (!rule) {
    return {
      totalEvaluatedPredictions:
        predictions.length,

      trainingPredictionCount:
        training.length,

      validationPredictionCount:
        validation.length,

      trainingBaselineAccuracy:
        calculateAccuracy(
          training,
        ),

      validationBaselineAccuracy:
        calculateAccuracy(
          validation,
        ),

      rule: null,

      validation: null,

      trainingPicks: [],

      validationPicks: [],

      testedRules:
        sortedRules,
    };
  }

  const trainingPicks =
    training.filter(
      (prediction) =>
        matchesRule(
          prediction,
          rule.minimumProbability,
          rule.minimumConfidence,
        ),
    );

  const validationResult =
    validateRule({
      rule,

      validationPredictions:
        validation,
    });

  return {
    totalEvaluatedPredictions:
      predictions.length,

    trainingPredictionCount:
      training.length,

    validationPredictionCount:
      validation.length,

    trainingBaselineAccuracy:
      calculateAccuracy(
        training,
      ),

    validationBaselineAccuracy:
      calculateAccuracy(
        validation,
      ),

    rule,

    validation:
      validationResult.validation,

    trainingPicks,

    validationPicks:
      validationResult.picks,

    testedRules:
      sortedRules,
  };
}