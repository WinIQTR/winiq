import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

import type {
  CalibrationBucket,
  CalibrationProfile,
  OutcomeCalibrationProfile,
} from "./types";

export type CalibrationPredictionRow = {
  actualOutcome: MatchOutcome;

  probabilities:
    OutcomeProbabilities;
};

export type BuildCalibrationFromPredictionsOptions = {
  rows:
    CalibrationPredictionRow[];

  leagueApiId?: number;
  seasonYear: number;

  sourceModelName: string;
  sourceModelVersion: string;

  priorStrength?: number;
  minimumReliableSampleSize?: number;

  bucketSize?: number;
};

const OUTCOMES:
  MatchOutcome[] = [
    "HOME",
    "DRAW",
    "AWAY",
  ];

function round(
  value: number,
  decimals = 2,
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

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function getProbability(
  probabilities:
    OutcomeProbabilities,

  outcome:
    MatchOutcome,
): number {
  switch (outcome) {
    case "HOME":
      return probabilities.home;

    case "DRAW":
      return probabilities.draw;

    case "AWAY":
      return probabilities.away;
  }
}

function calculateReliabilityScore(
  options: {
    sampleSize: number;

    minimumReliableSampleSize:
      number;
  },
): number {
  if (
    options.sampleSize <=
    0
  ) {
    return 0;
  }

  return round(
    clamp(
      (
        options.sampleSize /
        options
          .minimumReliableSampleSize
      ) *
        100,
      0,
      100,
    ),
  );
}

function buildBuckets(
  bucketSize: number,
): Array<{
  minimum: number;
  maximum: number;
  label: string;
}> {
  const buckets:
    Array<{
      minimum: number;
      maximum: number;
      label: string;
    }> = [];

  for (
    let minimum = 0;
    minimum < 100;
    minimum += bucketSize
  ) {
    const maximum =
      Math.min(
        minimum +
          bucketSize,
        100,
      );

    buckets.push({
      minimum,

      maximum,

      label:
        `${minimum}-${maximum}%`,
    });
  }

  return buckets;
}

function isInsideBucket(
  probability: number,
  minimum: number,
  maximum: number,
): boolean {
  if (
    maximum === 100
  ) {
    return (
      probability >=
        minimum &&
      probability <=
        maximum
    );
  }

  return (
    probability >=
      minimum &&
    probability <
      maximum
  );
}

function buildOutcomeProfile(
  options: {
    rows:
      CalibrationPredictionRow[];

    outcome:
      MatchOutcome;

    priorStrength:
      number;

    minimumReliableSampleSize:
      number;

    bucketSize:
      number;
  },
): OutcomeCalibrationProfile {
  const totalMatches =
    options.rows.length;

  const totalOccurred =
    options.rows.filter(
      (
        row,
      ) =>
        row.actualOutcome ===
        options.outcome,
    ).length;

  const baseRate =
    totalMatches >
    0
      ? totalOccurred /
        totalMatches
      : 0;

  const bucketDefinitions =
    buildBuckets(
      options.bucketSize,
    );

  const buckets:
    CalibrationBucket[] =
      [];

  for (
    const definition
    of bucketDefinitions
  ) {
    const bucketRows =
      options.rows.filter(
        (
          row,
        ) => {
          const probability =
            getProbability(
              row.probabilities,
              options.outcome,
            );

          return isInsideBucket(
            probability,
            definition.minimum,
            definition.maximum,
          );
        },
      );

    if (
      bucketRows.length ===
      0
    ) {
      continue;
    }

    const occurred =
      bucketRows.filter(
        (
          row,
        ) =>
          row.actualOutcome ===
          options.outcome,
      ).length;

    const rawOccurrenceRate =
      occurred /
      bucketRows.length;

    const averagePredictedProbability =
      bucketRows.reduce(
        (
          total,
          row,
        ) =>
          total +
          getProbability(
            row.probabilities,
            options.outcome,
          ),
        0,
      ) /
      bucketRows.length;

    /*
     * Bayesian smoothing:
     *
     * Küçük bucket'larda ölçülen oranı
     * doğrudan kullanmak yerine genel
     * gerçekleşme oranına doğru çekeriz.
     */
    const smoothedOccurrenceRate =
      (
        occurred +
        options.priorStrength *
          baseRate
      ) /
      (
        bucketRows.length +
        options.priorStrength
      );

    const rawOccurrencePercentage =
      round(
        rawOccurrenceRate *
          100,
      );

    const smoothedOccurrencePercentage =
      round(
        smoothedOccurrenceRate *
          100,
      );

    buckets.push({
      outcome:
        options.outcome,

      minimumProbability:
        definition.minimum,

      maximumProbability:
        definition.maximum,

      label:
        definition.label,

      sampleSize:
        bucketRows.length,

      occurred,

      rawOccurrencePercentage,

      smoothedOccurrencePercentage,

      averagePredictedProbability:
        round(
          averagePredictedProbability,
        ),

      calibrationDifference:
        round(
          smoothedOccurrencePercentage -
            averagePredictedProbability,
        ),

      reliabilityScore:
        calculateReliabilityScore({
          sampleSize:
            bucketRows.length,

          minimumReliableSampleSize:
            options
              .minimumReliableSampleSize,
        }),
    });
  }

  return {
    outcome:
      options.outcome,

    totalMatches,

    totalOccurred,

    baseRatePercentage:
      round(
        baseRate *
          100,
      ),

    buckets,
  };
}

export function buildCalibrationProfileFromPredictions(
  options:
    BuildCalibrationFromPredictionsOptions,
): CalibrationProfile {
  if (
    options.rows.length ===
    0
  ) {
    throw new Error(
      "Calibration profile için en az bir tahmin satırı gereklidir.",
    );
  }

  const priorStrength =
    options.priorStrength ??
    20;

  const minimumReliableSampleSize =
    options
      .minimumReliableSampleSize ??
    40;

  const bucketSize =
    options.bucketSize ??
    10;

  if (
    priorStrength < 0 ||
    !Number.isFinite(
      priorStrength,
    )
  ) {
    throw new Error(
      "priorStrength sıfır veya pozitif olmalıdır.",
    );
  }

  if (
    minimumReliableSampleSize <=
      0 ||
    !Number.isFinite(
      minimumReliableSampleSize,
    )
  ) {
    throw new Error(
      "minimumReliableSampleSize pozitif olmalıdır.",
    );
  }

  if (
    bucketSize <= 0 ||
    bucketSize > 100 ||
    !Number.isFinite(
      bucketSize,
    )
  ) {
    throw new Error(
      "bucketSize 0 ile 100 arasında olmalıdır.",
    );
  }

  const outcomes =
    Object.fromEntries(
      OUTCOMES.map(
        (
          outcome,
        ) => [
          outcome,

          buildOutcomeProfile({
            rows:
              options.rows,

            outcome,

            priorStrength,

            minimumReliableSampleSize,

            bucketSize,
          }),
        ],
      ),
    ) as Record<
      MatchOutcome,
      OutcomeCalibrationProfile
    >;

  return {
    profileName:
      options.leagueApiId
        ? `league-${options.leagueApiId}-season-${options.seasonYear}-ensemble-calibration`
        : `multi-competition-season-${options.seasonYear}-ensemble-calibration`,

    version:
      "calibration-v1.0",

    /*
     * 0 = global / multi-competition profile.
     */
    leagueApiId:
      options.leagueApiId ??
      0,

    seasonYear:
      options.seasonYear,

    sourceModelName:
      options.sourceModelName,

    sourceModelVersion:
      options.sourceModelVersion,

    createdAt:
      new Date()
        .toISOString(),

    priorStrength,

    minimumReliableSampleSize,

    outcomes,
  };
}