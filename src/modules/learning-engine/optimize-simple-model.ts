import {
  trainSimpleLearningModel,
} from "./train-simple-model";

import type {
  ChronologicalTrainingSplit,
  SimpleLearningModelConfig,
  SimpleLearningResult,
} from "./types";

export type SimpleOptimizerSearchSpace = {
  learningRates: number[];
  maximumEpochs: number[];
  l2Regularizations: number[];
  convergenceTolerances: number[];
};

export type SimpleOptimizerCandidate = {
  candidateNumber: number;

  configuration:
    Required<SimpleLearningModelConfig>;

  trainingAccuracy: number;
  validationAccuracy: number;

  validationBrierScore: number;
  validationLogLoss: number;

  averageConfidencePercentage: number;

  epochsCompleted: number;
  finalTrainingLoss: number;
};

export type SimpleOptimizerResult = {
  evaluatedCandidateCount: number;

  bestCandidate:
    SimpleOptimizerCandidate;

  bestLearningResult:
    SimpleLearningResult;

  leaderboard:
    SimpleOptimizerCandidate[];

  searchSpace:
    SimpleOptimizerSearchSpace;

  warnings: string[];
};

const DEFAULT_SEARCH_SPACE:
  SimpleOptimizerSearchSpace = {
    learningRates: [
      0.01,
      0.03,
      0.05,
    ],

    maximumEpochs: [
      1500,
      3000,
      5000,
    ],

    l2Regularizations: [
      0,
      0.001,
      0.01,
      0.05,
    ],

    convergenceTolerances: [
      0.0000001,
    ],
  };

function isCandidateBetter(
  candidate: SimpleOptimizerCandidate,
  currentBest: SimpleOptimizerCandidate,
): boolean {
  /*
   * Birinci hedef:
   * Olasılıkların gerçekçiliği.
   *
   * Daha düşük Brier Score daha iyidir.
   */
  if (
    candidate.validationBrierScore <
    currentBest.validationBrierScore
  ) {
    return true;
  }

  if (
    candidate.validationBrierScore >
    currentBest.validationBrierScore
  ) {
    return false;
  }

  /*
   * İkinci hedef:
   * Daha düşük Log Loss.
   */
  if (
    candidate.validationLogLoss <
    currentBest.validationLogLoss
  ) {
    return true;
  }

  if (
    candidate.validationLogLoss >
    currentBest.validationLogLoss
  ) {
    return false;
  }

  /*
   * Son eşitlik bozucu:
   * Daha yüksek doğruluk.
   */
  return (
    candidate.validationAccuracy >
    currentBest.validationAccuracy
  );
}

function sortLeaderboard(
  candidates:
    SimpleOptimizerCandidate[],
): SimpleOptimizerCandidate[] {
  return [...candidates].sort(
    (left, right) => {
      if (
        left.validationBrierScore !==
        right.validationBrierScore
      ) {
        return (
          left.validationBrierScore -
          right.validationBrierScore
        );
      }

      if (
        left.validationLogLoss !==
        right.validationLogLoss
      ) {
        return (
          left.validationLogLoss -
          right.validationLogLoss
        );
      }

      return (
        right.validationAccuracy -
        left.validationAccuracy
      );
    },
  );
}

export function optimizeSimpleLearningModel(
  split: ChronologicalTrainingSplit,
  options?: {
    searchSpace?:
      Partial<SimpleOptimizerSearchSpace>;

    featureNames?: string[];

    leaderboardSize?: number;

    onProgress?: (
      candidate:
        SimpleOptimizerCandidate,
      totalCandidateCount: number,
    ) => void;
  },
): SimpleOptimizerResult {
  const searchSpace:
    SimpleOptimizerSearchSpace = {
    learningRates:
      options?.searchSpace
        ?.learningRates ??
      DEFAULT_SEARCH_SPACE
        .learningRates,

    maximumEpochs:
      options?.searchSpace
        ?.maximumEpochs ??
      DEFAULT_SEARCH_SPACE
        .maximumEpochs,

    l2Regularizations:
      options?.searchSpace
        ?.l2Regularizations ??
      DEFAULT_SEARCH_SPACE
        .l2Regularizations,

    convergenceTolerances:
      options?.searchSpace
        ?.convergenceTolerances ??
      DEFAULT_SEARCH_SPACE
        .convergenceTolerances,
  };

  const totalCandidateCount =
    searchSpace.learningRates.length *
    searchSpace.maximumEpochs.length *
    searchSpace
      .l2Regularizations.length *
    searchSpace
      .convergenceTolerances.length;

  if (totalCandidateCount === 0) {
    throw new Error(
      "Optimizer search space boş olamaz.",
    );
  }

  const candidates:
    SimpleOptimizerCandidate[] = [];

  let bestCandidate:
    SimpleOptimizerCandidate | null =
    null;

  let bestLearningResult:
    SimpleLearningResult | null =
    null;

  let candidateNumber = 0;

  for (
    const learningRate
    of searchSpace.learningRates
  ) {
    for (
      const maximumEpochs
      of searchSpace.maximumEpochs
    ) {
      for (
        const l2Regularization
        of searchSpace.l2Regularizations
      ) {
        for (
          const convergenceTolerance
          of searchSpace
            .convergenceTolerances
        ) {
          candidateNumber += 1;

          const learningResult =
            trainSimpleLearningModel(
              split,
              {
                ...(options
                  ?.featureNames
                  ? {
                      featureNames:
                        options.featureNames,
                    }
                  : {}),

                learningRate,
                maximumEpochs,
                l2Regularization,
                convergenceTolerance,
              },
            );

          const candidate:
            SimpleOptimizerCandidate = {
            candidateNumber,

            configuration:
              learningResult
                .model
                .configuration,

            trainingAccuracy:
              learningResult
                .trainingMetrics
                .accuracyPercentage,

            validationAccuracy:
              learningResult
                .validationMetrics
                .accuracyPercentage,

            validationBrierScore:
              learningResult
                .validationMetrics
                .brierScore,

            validationLogLoss:
              learningResult
                .validationMetrics
                .logLoss,

            averageConfidencePercentage:
              learningResult
                .validationMetrics
                .averageConfidencePercentage,

            epochsCompleted:
              learningResult
                .model
                .epochsCompleted,

            finalTrainingLoss:
              learningResult
                .model
                .finalTrainingLoss,
          };

          candidates.push(candidate);

          if (
            bestCandidate === null ||
            isCandidateBetter(
              candidate,
              bestCandidate,
            )
          ) {
            bestCandidate = candidate;
            bestLearningResult =
              learningResult;
          }

          options?.onProgress?.(
            candidate,
            totalCandidateCount,
          );
        }
      }
    }
  }

  if (
    bestCandidate === null ||
    bestLearningResult === null
  ) {
    throw new Error(
      "Optimizer geçerli bir model üretemedi.",
    );
  }

  const sortedCandidates =
    sortLeaderboard(candidates);

  const leaderboardSize =
    Math.max(
      options?.leaderboardSize ?? 10,
      1,
    );

  const warnings: string[] = [];

  const trainingValidationGap =
    bestCandidate.trainingAccuracy -
    bestCandidate.validationAccuracy;

  if (trainingValidationGap > 10) {
    warnings.push(
      [
        "En iyi modelde training ve validation",
        "arasında yüksek doğruluk farkı var:",
        `${trainingValidationGap.toFixed(2)} puan.`,
        "Overfitting riski olabilir.",
      ].join(" "),
    );
  }

  const validationLeakageCount =
    split.validation.metadata.filter(
      (row) =>
        row
          .containsPostMatchCalculatedFeatures,
    ).length;

  if (validationLeakageCount > 0) {
    warnings.push(
      [
        validationLeakageCount,
        "validation maçında maç sonrası",
        "hesaplanan feature riski bulunuyor.",
        "Optimizer sonucu EXPERIMENTAL kabul edilmelidir.",
      ].join(" "),
    );
  }

  return {
    evaluatedCandidateCount:
      candidates.length,

    bestCandidate,

    bestLearningResult,

    leaderboard:
      sortedCandidates.slice(
        0,
        leaderboardSize,
      ),

    searchSpace,

    warnings,
  };
}