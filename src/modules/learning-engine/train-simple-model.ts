import type {
  ChronologicalTrainingSplit,
  FeatureStandardization,
  LearnedModelEvaluation,
  LearnedOutcomeMetrics,
  MatchOutcome,
  SimpleLearningClassWeights,
  SimpleLearningModel,
  SimpleLearningModelConfig,
  SimpleLearningResult,
  TrainingMatrixPartition,
} from "./types";

const DEFAULT_FEATURE_NAMES = [
  "diff_last_5_points_per_game",
  "diff_goals_scored_per_game",
  "diff_goals_conceded_per_game",
  "diff_rest_days",

  "diff_venue_last_5_points_per_game",
  "diff_venue_goals_scored_per_game",
  "diff_venue_goals_conceded_per_game",
] as const;

const MINIMUM_PROBABILITY =
  1e-15;

const DEFAULT_CLASS_WEIGHTS:
  SimpleLearningClassWeights = {
  HOME: 1,
  DRAW: 1,
  AWAY: 1,
};

function round(
  value: number,
  decimals = 6,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
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
        `Geçersiz outcome sınıfı: ${value}`,
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

function getClassWeight(
  classIndex: number,
  classWeights:
    SimpleLearningClassWeights,
): number {
  switch (classIndex) {
    case 0:
      return classWeights.HOME;

    case 1:
      return classWeights.DRAW;

    case 2:
      return classWeights.AWAY;

    default:
      throw new Error(
        `Geçersiz class index: ${classIndex}`,
      );
  }
}

function validateClassWeights(
  classWeights:
    SimpleLearningClassWeights,
): void {
  const values = [
    classWeights.HOME,
    classWeights.DRAW,
    classWeights.AWAY,
  ];

  for (
    const value
    of values
  ) {
    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw new Error(
        "Class weight değerleri pozitif ve sonlu sayılar olmalıdır.",
      );
    }
  }
}

function findFeatureIndexes(
  allFeatureNames: string[],
  requestedFeatureNames: string[],
): number[] {
  return requestedFeatureNames.map(
    (
      featureName,
    ) => {
      const index =
        allFeatureNames.indexOf(
          featureName,
        );

      if (
        index === -1
      ) {
        throw new Error(
          `Learning feature bulunamadı: ${featureName}`,
        );
      }

      return index;
    },
  );
}

function calculateStandardization(
  options: {
    partition:
      TrainingMatrixPartition;

    featureIndexes:
      number[];

    featureNames:
      string[];
  },
): FeatureStandardization[] {
  return options.featureIndexes.map(
    (
      featureIndex,
      position,
    ) => {
      const values =
        options.partition.X.map(
          (
            row,
          ) =>
            row[
              featureIndex
            ],
        );

      const mean =
        values.reduce(
          (
            total,
            value,
          ) =>
            total +
            value,
          0,
        ) /
        values.length;

      const variance =
        values.reduce(
          (
            total,
            value,
          ) => {
            const difference =
              value -
              mean;

            return (
              total +
              difference **
                2
            );
          },
          0,
        ) /
        values.length;

      const standardDeviation =
        Math.sqrt(
          variance,
        );

      return {
        featureName:
          options.featureNames[
            position
          ],

        mean:
          round(
            mean,
          ),

        standardDeviation:
          round(
            standardDeviation >
              0
              ? standardDeviation
              : 1,
          ),
      };
    },
  );
}

function transformPartition(
  options: {
    partition:
      TrainingMatrixPartition;

    featureIndexes:
      number[];

    standardization:
      FeatureStandardization[];
  },
): number[][] {
  return options.partition.X.map(
    (
      row,
    ) =>
      options.featureIndexes.map(
        (
          featureIndex,
          position,
        ) => {
          const statistics =
            options.standardization[
              position
            ];

          return (
            (
              row[
                featureIndex
              ] -
              statistics.mean
            ) /
            statistics
              .standardDeviation
          );
        },
      ),
  );
}

function softmax(
  scores: number[],
): number[] {
  const maximumScore =
    Math.max(
      ...scores,
    );

  const exponentials =
    scores.map(
      (
        score,
      ) =>
        Math.exp(
          score -
            maximumScore,
        ),
    );

  const total =
    exponentials.reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    );

  return exponentials.map(
    (
      value,
    ) =>
      value /
      total,
  );
}

function predictProbabilities(
  options: {
    features:
      number[];

    weights:
      number[][];
  },
): number[] {
  const inputWithBias = [
    1,
    ...options.features,
  ];

  const scores =
    options.weights.map(
      (
        classWeights,
      ) =>
        classWeights.reduce(
          (
            total,
            weight,
            index,
          ) =>
            total +
            weight *
              inputWithBias[
                index
              ],
          0,
        ),
    );

  return softmax(
    scores,
  );
}

function calculateTrainingLoss(
  options: {
    X:
      number[][];

    yClass:
      number[];

    weights:
      number[][];

    l2Regularization:
      number;

    classWeights:
      SimpleLearningClassWeights;
  },
): number {
  let totalLoss =
    0;

  let totalSampleWeight =
    0;

  for (
    let rowIndex = 0;
    rowIndex <
    options.X.length;
    rowIndex += 1
  ) {
    const probabilities =
      predictProbabilities({
        features:
          options.X[
            rowIndex
          ],

        weights:
          options.weights,
      });

    const actualClass =
      options.yClass[
        rowIndex
      ];

    const sampleWeight =
      getClassWeight(
        actualClass,
        options.classWeights,
      );

    const actualProbability =
      Math.max(
        probabilities[
          actualClass
        ],
        MINIMUM_PROBABILITY,
      );

    totalLoss +=
      -Math.log(
        actualProbability,
      ) *
      sampleWeight;

    totalSampleWeight +=
      sampleWeight;
  }

  let regularizationPenalty =
    0;

  for (
    const classWeights
    of options.weights
  ) {
    /*
     * Bias regularization'a
     * dahil edilmez.
     */
    for (
      let index = 1;
      index <
      classWeights.length;
      index += 1
    ) {
      regularizationPenalty +=
        classWeights[
          index
        ] **
        2;
    }
  }

  const weightedAverageLoss =
    totalLoss /
    Math.max(
      totalSampleWeight,
      1,
    );

  return (
    weightedAverageLoss +
    (
      options
        .l2Regularization /
      2
    ) *
      regularizationPenalty
  );
}

function trainWeights(
  options: {
    X:
      number[][];

    yClass:
      number[];

    learningRate:
      number;

    maximumEpochs:
      number;

    l2Regularization:
      number;

    convergenceTolerance:
      number;

    classWeights:
      SimpleLearningClassWeights;
  },
): {
  weights:
    number[][];

  epochsCompleted:
    number;

  finalTrainingLoss:
    number;
} {
  const classCount =
    3;

  const inputCount =
    options.X[0].length +
    1;

  const weights =
    Array.from(
      {
        length:
          classCount,
      },
      () =>
        Array.from(
          {
            length:
              inputCount,
          },
          () =>
            0,
        ),
    );

  /*
   * Weighted gradient'i normalize
   * etmek için training set'in toplam
   * sample weight'ini önceden hesaplarız.
   */
  const totalSampleWeight =
    options.yClass.reduce(
      (
        total,
        classIndex,
      ) =>
        total +
        getClassWeight(
          classIndex,
          options.classWeights,
        ),
      0,
    );

  let previousLoss =
    Number.POSITIVE_INFINITY;

  let finalTrainingLoss =
    Number.POSITIVE_INFINITY;

  let epochsCompleted =
    0;

  for (
    let epoch = 1;
    epoch <=
    options.maximumEpochs;
    epoch += 1
  ) {
    const gradients =
      Array.from(
        {
          length:
            classCount,
        },
        () =>
          Array.from(
            {
              length:
                inputCount,
            },
            () =>
              0,
          ),
      );

    for (
      let rowIndex = 0;
      rowIndex <
      options.X.length;
      rowIndex += 1
    ) {
      const features = [
        1,
        ...options.X[
          rowIndex
        ],
      ];

      const probabilities =
        predictProbabilities({
          features:
            options.X[
              rowIndex
            ],

          weights,
        });

      const actualClass =
        options.yClass[
          rowIndex
        ];

      const sampleWeight =
        getClassWeight(
          actualClass,
          options.classWeights,
        );

      for (
        let classIndex = 0;
        classIndex <
        classCount;
        classIndex += 1
      ) {
        const actualValue =
          classIndex ===
          actualClass
            ? 1
            : 0;

        const error =
          probabilities[
            classIndex
          ] -
          actualValue;

        for (
          let featureIndex = 0;
          featureIndex <
          inputCount;
          featureIndex += 1
        ) {
          gradients[
            classIndex
          ][
            featureIndex
          ] +=
            error *
            features[
              featureIndex
            ] *
            sampleWeight;
        }
      }
    }

    for (
      let classIndex = 0;
      classIndex <
      classCount;
      classIndex += 1
    ) {
      for (
        let featureIndex = 0;
        featureIndex <
        inputCount;
        featureIndex += 1
      ) {
        let gradient =
          gradients[
            classIndex
          ][
            featureIndex
          ] /
          Math.max(
            totalSampleWeight,
            1,
          );

        if (
          featureIndex >
          0
        ) {
          gradient +=
            options
              .l2Regularization *
            weights[
              classIndex
            ][
              featureIndex
            ];
        }

        weights[
          classIndex
        ][
          featureIndex
        ] -=
          options
            .learningRate *
          gradient;
      }
    }

    finalTrainingLoss =
      calculateTrainingLoss({
        X:
          options.X,

        yClass:
          options.yClass,

        weights,

        l2Regularization:
          options
            .l2Regularization,

        classWeights:
          options
            .classWeights,
      });

    epochsCompleted =
      epoch;

    const improvement =
      Math.abs(
        previousLoss -
          finalTrainingLoss,
      );

    if (
      improvement <
      options
        .convergenceTolerance
    ) {
      break;
    }

    previousLoss =
      finalTrainingLoss;
  }

  return {
    weights:
      weights.map(
        (
          classWeights,
        ) =>
          classWeights.map(
            (
              weight,
            ) =>
              round(
                weight,
              ),
          ),
      ),

    epochsCompleted,

    finalTrainingLoss:
      round(
        finalTrainingLoss,
      ),
  };
}

function calculateOutcomePerformance(
  options: {
    actualOutcomes:
      MatchOutcome[];

    predictedOutcomes:
      MatchOutcome[];
  },
): LearnedOutcomeMetrics[] {
  const outcomes:
    MatchOutcome[] = [
    "HOME",
    "DRAW",
    "AWAY",
  ];

  return outcomes.map(
    (
      outcome,
    ) => {
      const actualCount =
        options.actualOutcomes.filter(
          (
            value,
          ) =>
            value ===
            outcome,
        ).length;

      const predictedCount =
        options.predictedOutcomes.filter(
          (
            value,
          ) =>
            value ===
            outcome,
        ).length;

      const correctCount =
        options.actualOutcomes.reduce(
          (
            total,
            actualOutcome,
            index,
          ) =>
            total +
            Number(
              actualOutcome ===
                outcome &&
                options
                  .predictedOutcomes[
                  index
                ] ===
                  outcome,
            ),
          0,
        );

      return {
        outcome,

        actualCount,

        predictedCount,

        correctCount,

        recallPercentage:
          actualCount >
          0
            ? round(
                (
                  correctCount /
                  actualCount
                ) *
                  100,
                2,
              )
            : null,

        precisionPercentage:
          predictedCount >
          0
            ? round(
                (
                  correctCount /
                  predictedCount
                ) *
                  100,
                2,
              )
            : null,
      };
    },
  );
}

function evaluatePartition(
  options: {
    partition:
      TrainingMatrixPartition;

    transformedX:
      number[][];

    weights:
      number[][];
  },
): {
  metrics:
    LearnedModelEvaluation;

  predictions:
    SimpleLearningResult[
      "validationPredictions"
    ];
} {
  const actualOutcomes =
    options.partition.yClass.map(
      classToOutcome,
    );

  const predictedOutcomes:
    MatchOutcome[] = [];

  const predictions:
    SimpleLearningResult[
      "validationPredictions"
    ] = [];

  let correctPredictionCount =
    0;

  let totalBrierScore =
    0;

  let totalLogLoss =
    0;

  let totalConfidence =
    0;

  for (
    let index = 0;
    index <
    options.transformedX.length;
    index += 1
  ) {
    const probabilities =
      predictProbabilities({
        features:
          options
            .transformedX[
            index
          ],

        weights:
          options.weights,
      });

    const highestProbability =
      Math.max(
        ...probabilities,
      );

    const predictedClass =
      probabilities.indexOf(
        highestProbability,
      );

    const predictedOutcome =
      classToOutcome(
        predictedClass,
      );

    const actualOutcome =
      actualOutcomes[
        index
      ];

    const actualIndex =
      outcomeToIndex(
        actualOutcome,
      );

    const isCorrect =
      predictedOutcome ===
      actualOutcome;

    if (
      isCorrect
    ) {
      correctPredictionCount +=
        1;
    }

    predictedOutcomes.push(
      predictedOutcome,
    );

    const actualVector = [
      0,
      0,
      0,
    ];

    actualVector[
      actualIndex
    ] = 1;

    totalBrierScore +=
      probabilities.reduce(
        (
          total,
          probability,
          classIndex,
        ) => {
          const error =
            probability -
            actualVector[
              classIndex
            ];

          return (
            total +
            error **
              2
          );
        },
        0,
      );

    totalLogLoss +=
      -Math.log(
        Math.max(
          probabilities[
            actualIndex
          ],
          MINIMUM_PROBABILITY,
        ),
      );

    totalConfidence +=
      highestProbability;

    const metadata =
      options.partition
        .metadata[
        index
      ];

    predictions.push({
      matchId:
        metadata.matchId,

      match:
        `${metadata.homeTeamName} - ${metadata.awayTeamName}`,

      actualOutcome,

      predictedOutcome,

      homeProbability:
        round(
          probabilities[
            0
          ] *
            100,
          2,
        ),

      drawProbability:
        round(
          probabilities[
            1
          ] *
            100,
          2,
        ),

      awayProbability:
        round(
          probabilities[
            2
          ] *
            100,
          2,
        ),

      confidencePercentage:
        round(
          highestProbability *
            100,
          2,
        ),

      isCorrect,
    });
  }

  const evaluatedMatchCount =
    actualOutcomes.length;

  return {
    metrics: {
      evaluatedMatchCount,

      correctPredictionCount,

      incorrectPredictionCount:
        evaluatedMatchCount -
        correctPredictionCount,

      accuracyPercentage:
        round(
          (
            correctPredictionCount /
            evaluatedMatchCount
          ) *
            100,
          2,
        ),

      brierScore:
        round(
          totalBrierScore /
            evaluatedMatchCount,
        ),

      logLoss:
        round(
          totalLogLoss /
            evaluatedMatchCount,
        ),

      averageConfidencePercentage:
        round(
          (
            totalConfidence /
            evaluatedMatchCount
          ) *
            100,
          2,
        ),

      outcomePerformance:
        calculateOutcomePerformance({
          actualOutcomes,
          predictedOutcomes,
        }),
    },

    predictions,
  };
}

export function trainSimpleLearningModel(
  split:
    ChronologicalTrainingSplit,

  config?:
    SimpleLearningModelConfig,
): SimpleLearningResult {
  const configuration:
    Required<
      SimpleLearningModelConfig
    > = {
    featureNames:
      config?.featureNames ??
      [
        ...DEFAULT_FEATURE_NAMES,
      ],

    learningRate:
      config?.learningRate ??
      0.01,

    maximumEpochs:
      config?.maximumEpochs ??
      1500,

    l2Regularization:
      config?.l2Regularization ??
      0.05,

    convergenceTolerance:
      config
        ?.convergenceTolerance ??
      0.0000001,

    classWeights:
      config?.classWeights ??
      {
        ...DEFAULT_CLASS_WEIGHTS,
      },
  };

  validateClassWeights(
    configuration.classWeights,
  );

  const featureIndexes =
    findFeatureIndexes(
      split.training
        .featureNames,

      configuration
        .featureNames,
    );

  const standardization =
    calculateStandardization({
      partition:
        split.training,

      featureIndexes,

      featureNames:
        configuration
          .featureNames,
    });

  const trainingX =
    transformPartition({
      partition:
        split.training,

      featureIndexes,

      standardization,
    });

  const validationX =
    transformPartition({
      partition:
        split.validation,

      featureIndexes,

      standardization,
    });

  const trained =
    trainWeights({
      X:
        trainingX,

      yClass:
        split.training
          .yClass,

      learningRate:
        configuration
          .learningRate,

      maximumEpochs:
        configuration
          .maximumEpochs,

      l2Regularization:
        configuration
          .l2Regularization,

      convergenceTolerance:
        configuration
          .convergenceTolerance,

      classWeights:
        configuration
          .classWeights,
    });

  const model:
    SimpleLearningModel = {
    featureNames:
      configuration
        .featureNames,

    weights:
      trained.weights,

    standardization,

    epochsCompleted:
      trained
        .epochsCompleted,

    finalTrainingLoss:
      trained
        .finalTrainingLoss,

    configuration,
  };

  const trainingEvaluation =
    evaluatePartition({
      partition:
        split.training,

      transformedX:
        trainingX,

      weights:
        trained.weights,
    });

  const validationEvaluation =
    evaluatePartition({
      partition:
        split.validation,

      transformedX:
        validationX,

      weights:
        trained.weights,
    });

  const warnings:
    string[] = [];

  const accuracyGap =
    trainingEvaluation
      .metrics
      .accuracyPercentage -
    validationEvaluation
      .metrics
      .accuracyPercentage;

  if (
    accuracyGap >
    10
  ) {
    warnings.push(
      [
        "Training ve validation doğruluğu arasında",
        round(
          accuracyGap,
          2,
        ),
        "puan fark var.",
        "Overfitting riski bulunuyor.",
      ].join(" "),
    );
  }

  const validationLeakageCount =
    split.validation
      .metadata
      .filter(
        (
          row,
        ) =>
          row
            .containsPostMatchCalculatedFeatures,
      )
      .length;

  if (
    validationLeakageCount >
    0
  ) {
    warnings.push(
      [
        validationLeakageCount,
        "validation maçında maç sonrası hesaplanan feature riski bulunuyor.",
        "Sonuç EXPERIMENTAL kabul edilmelidir.",
      ].join(" "),
    );
  }

  return {
    model,

    trainingMetrics:
      trainingEvaluation
        .metrics,

    validationMetrics:
      validationEvaluation
        .metrics,

    baselineAccuracyPercentage:
      null,

    validationAccuracyImprovement:
      null,

    validationPredictions:
      validationEvaluation
        .predictions,

    warnings,
  };
}