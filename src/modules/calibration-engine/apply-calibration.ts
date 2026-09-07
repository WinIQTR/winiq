import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

import type {
  CalibratedOutcomeDetail,
  CalibrationBucket,
  CalibrationProfile,
  CalibrationResult,
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

function getRawProbability(options: {
  probabilities: OutcomeProbabilities;
  outcome: MatchOutcome;
}): number {
  switch (options.outcome) {
    case "HOME":
      return options.probabilities.home;

    case "DRAW":
      return options.probabilities.draw;

    case "AWAY":
      return options.probabilities.away;
  }
}

function findBucket(
  buckets: CalibrationBucket[],
  probability: number,
): CalibrationBucket | null {
  return (
    buckets.find(
      (bucket) =>
        probability >=
          bucket.minimumProbability &&
        probability <=
          bucket.maximumProbability,
    ) ?? null
  );
}

function normalizeCalibratedValues(
  values: Record<MatchOutcome, number>,
): OutcomeProbabilities {
  const total =
    values.HOME +
    values.DRAW +
    values.AWAY;

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      home: 33.33,
      draw: 33.34,
      away: 33.33,
    };
  }

  const home =
    round(
      values.HOME / total * 100,
    );

  const draw =
    round(
      values.DRAW / total * 100,
    );

  const away =
    round(
      100 - home - draw,
    );

  return {
    home,
    draw,
    away,
  };
}

export function applyCalibration(options: {
  probabilities: OutcomeProbabilities;
  profile: CalibrationProfile;
}): CalibrationResult {
  const {
    probabilities,
    profile,
  } = options;

  const warnings: string[] = [];

  const unnormalizedValues =
    {} as Record<MatchOutcome, number>;

  const details =
    {} as Record<
      MatchOutcome,
      CalibratedOutcomeDetail
    >;

  for (const outcome of OUTCOMES) {
    const rawProbability =
      getRawProbability({
        probabilities,
        outcome,
      });

    const outcomeProfile =
      profile.outcomes[outcome];

    const bucket =
      findBucket(
        outcomeProfile.buckets,
        rawProbability,
      );

    /*
     * Olasılık aralığına ait geçmiş veri yoksa,
     * ilgili marketin genel gerçekleşme oranı kullanılır.
     */
    const calibratedProbability =
      bucket
        ? bucket.smoothedOccurrencePercentage
        : outcomeProfile.baseRatePercentage;

    if (!bucket) {
      warnings.push(
        `${outcome} için ${rawProbability}% aralığında kalibrasyon örneği bulunamadı.`,
      );
    }

    const reliabilityScore =
      bucket?.reliabilityScore ?? 0;

    unnormalizedValues[outcome] =
      clamp(
        calibratedProbability,
        0.01,
        99.98,
      );

    details[outcome] = {
      outcome,

      rawProbability,

      calibratedProbability:
        round(calibratedProbability),

      bucketLabel:
        bucket?.label ?? null,

      sampleSize:
        bucket?.sampleSize ?? 0,

      reliabilityScore,

      rawHistoricalRate:
        bucket?.rawOccurrencePercentage ??
        null,

      smoothedHistoricalRate:
        bucket?.smoothedOccurrencePercentage ??
        null,
    };
  }

  const calibratedProbabilities =
    normalizeCalibratedValues(
      unnormalizedValues,
    );

  const usedReliabilities =
    OUTCOMES.map(
      (outcome) =>
        details[outcome].reliabilityScore,
    );

  /*
   * En zayıf market bucket'ı genel güveni sınırlar.
   */
  const overallReliabilityScore =
    round(
      Math.min(
        ...usedReliabilities,
      ),
    );

  if (
    overallReliabilityScore < 50
  ) {
    warnings.push(
      "Kalibrasyon örnek sayısı sınırlıdır; düzeltilmiş yüzdeler dikkatli yorumlanmalıdır.",
    );
  }

  return {
    rawProbabilities:
      probabilities,

    calibratedProbabilities,

    details,

    overallReliabilityScore,

    profileVersion:
      profile.version,

    warnings,
  };
}