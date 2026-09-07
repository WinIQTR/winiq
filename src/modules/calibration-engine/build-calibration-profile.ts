import type { MatchOutcome } from "@/modules/probability-engine";

import type { SeasonProbabilityBacktestResult } from "@/modules/probability-backtest-engine";

import type {
  CalibrationBucket,
  CalibrationProfile,
  OutcomeCalibrationProfile,
} from "./types";

const OUTCOMES: MatchOutcome[] = [
  "HOME",
  "DRAW",
  "AWAY",
];

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (denominator <= 0) {
    return 0;
  }

  return round(
    (numerator / denominator) * 100,
  );
}

function getActualOutcomeCount(
  result: SeasonProbabilityBacktestResult,
  outcome: MatchOutcome,
): number {
  return result.matches.reduce(
    (total, match) =>
      match.actualOutcome === outcome
        ? total + 1
        : total,
    0,
  );
}

function calculateReliabilityScore(options: {
  sampleSize: number;
  minimumReliableSampleSize: number;
}): number {
  if (options.sampleSize <= 0) {
    return 0;
  }

  return round(
    clamp(
      (
        options.sampleSize /
        options.minimumReliableSampleSize
      ) * 100,
      0,
      100,
    ),
  );
}

function buildOutcomeProfile(options: {
  result: SeasonProbabilityBacktestResult;
  outcome: MatchOutcome;
  priorStrength: number;
  minimumReliableSampleSize: number;
}): OutcomeCalibrationProfile {
  const {
    result,
    outcome,
    priorStrength,
    minimumReliableSampleSize,
  } = options;

  const totalMatches =
    result.matchesProcessed;

  const totalOccurred =
    getActualOutcomeCount(
      result,
      outcome,
    );

  const baseRatePercentage =
    percentage(
      totalOccurred,
      totalMatches,
    );

  const outcomeBuckets =
    result.marketBuckets.filter(
      (bucket) =>
        bucket.outcome === outcome &&
        bucket.total > 0,
    );

  const buckets =
    outcomeBuckets.map<CalibrationBucket>(
      (bucket) => {
        const rawOccurrencePercentage =
          bucket.actualOccurrencePercentage ?? 0;

        const averagePredictedProbability =
          bucket.averagePredictedProbability ?? 0;

        const smoothedOccurrencePercentage =
          round(
            (
              bucket.occurred +
              priorStrength *
                (
                  baseRatePercentage /
                  100
                )
            ) /
              (
                bucket.total +
                priorStrength
              ) *
              100,
          );

        const calibrationDifference =
          round(
            smoothedOccurrencePercentage -
              averagePredictedProbability,
          );

        return {
          outcome,

          minimumProbability:
            bucket.minimumProbability,

          maximumProbability:
            bucket.maximumProbability,

          label: bucket.label,

          sampleSize: bucket.total,
          occurred: bucket.occurred,

          rawOccurrencePercentage,
          smoothedOccurrencePercentage,

          averagePredictedProbability,
          calibrationDifference,

          reliabilityScore:
            calculateReliabilityScore({
              sampleSize: bucket.total,
              minimumReliableSampleSize,
            }),
        };
      },
    );

  return {
    outcome,
    totalMatches,
    totalOccurred,
    baseRatePercentage,
    buckets,
  };
}

export function buildCalibrationProfile(options: {
  result: SeasonProbabilityBacktestResult;
  priorStrength?: number;
  minimumReliableSampleSize?: number;
}): CalibrationProfile {
  const {
    result,
    priorStrength = 20,
    minimumReliableSampleSize = 40,
  } = options;

  if (result.matchesProcessed <= 0) {
    throw new Error(
      "Kalibrasyon profili için işlenmiş maç bulunamadı.",
    );
  }

  if (
    !Number.isFinite(priorStrength) ||
    priorStrength < 0
  ) {
    throw new Error(
      "priorStrength sıfır veya pozitif bir sayı olmalıdır.",
    );
  }

  if (
    !Number.isFinite(
      minimumReliableSampleSize,
    ) ||
    minimumReliableSampleSize <= 0
  ) {
    throw new Error(
      "minimumReliableSampleSize pozitif bir sayı olmalıdır.",
    );
  }

  const outcomeProfiles =
    Object.fromEntries(
      OUTCOMES.map((outcome) => [
        outcome,
        buildOutcomeProfile({
          result,
          outcome,
          priorStrength,
          minimumReliableSampleSize,
        }),
      ]),
    ) as Record<
      MatchOutcome,
      OutcomeCalibrationProfile
    >;

  return {
    profileName:
      `league-${result.leagueApiId}-season-${result.seasonYear}-1x2-calibration`,

    version: "calibration-v0.2",

    leagueApiId:
      result.leagueApiId,

    seasonYear:
      result.seasonYear,

    sourceModelName:
      result.model.name,

    sourceModelVersion:
      result.model.version,

    createdAt:
      new Date().toISOString(),

    priorStrength,
    minimumReliableSampleSize,

    outcomes: outcomeProfiles,
  };
}