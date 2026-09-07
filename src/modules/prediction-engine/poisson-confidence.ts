import type {
  GoalProbabilityResult,
} from "@/modules/goal-probability-engine/types";

import type {
  MatchOutcome,
  OutcomeProbabilities,
  ProbabilityConfidenceLevel,
} from "@/modules/probability-engine";

import type {
  DrawDecisionLayerResult,
} from "./draw-decision-layer";

export type PoissonConfidenceResult = {
  modelName:
    string;

  modelVersion:
    string;

  score:
    number;

  level:
    ProbabilityConfidenceLevel;

  predictedOutcome:
    MatchOutcome;

  predictedProbability:
    number;

  secondProbability:
    number;

  probabilityGap:
    number;

  dataQualityScore:
    number;

  separationScore:
    number;

  probabilityStrengthScore:
    number;

  warningPenalty:
    number;

  drawOverridePenalty:
    number;

  components: {
    leagueSampleScore:
      number;

    homeVenueSampleScore:
      number;

    awayVenueSampleScore:
      number;

    venueSampleScore:
      number;

    probabilitySeparationScore:
      number;

    probabilityStrengthScore:
      number;
  };

  dataQuality: {
    leagueMatches:
      number;

    homeVenueMatches:
      number;

    awayVenueMatches:
      number;

    minimumVenueMatches:
      number;

    averageVenueMatches:
      number;
  };

  reasons:
    string[];
};

export const POISSON_CONFIDENCE_MODEL_NAME =
  "poisson-data-confidence";

export const POISSON_CONFIDENCE_MODEL_VERSION =
  "v1.0";

function round(
  value: number,
  decimals = 2,
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

function getConfidenceLevel(
  score: number,
): ProbabilityConfidenceLevel {
  if (
    score >=
    85
  ) {
    return "VERY_HIGH";
  }

  if (
    score >=
    70
  ) {
    return "HIGH";
  }

  if (
    score >=
    55
  ) {
    return "MEDIUM";
  }

  if (
    score >=
    40
  ) {
    return "LOW";
  }

  return "VERY_LOW";
}

function getOutcomeProbability(
  probabilities:
    OutcomeProbabilities,

  outcome:
    MatchOutcome,
): number {
  switch (
    outcome
  ) {
    case "HOME":
      return probabilities.home;

    case "DRAW":
      return probabilities.draw;

    case "AWAY":
      return probabilities.away;
  }
}

function calculateSampleScore(
  matches: number,
  fullScoreAt:
    number,
): number {
  if (
    matches <=
    0
  ) {
    return 0;
  }

  return round(
    clamp(
      (
        matches /
        fullScoreAt
      ) *
        100,
      0,
      100,
    ),
  );
}

export function calculatePoissonConfidence(
  options: {
    goalModel:
      GoalProbabilityResult;

    probabilities:
      OutcomeProbabilities;

    finalOutcome:
      MatchOutcome;

    drawDecision:
      DrawDecisionLayerResult;
  },
): PoissonConfidenceResult {
  const entries:
    Array<{
      outcome:
        MatchOutcome;

      probability:
        number;
    }> = [
    {
      outcome:
        "HOME",

      probability:
        options
          .probabilities
          .home,
    },

    {
      outcome:
        "DRAW",

      probability:
        options
          .probabilities
          .draw,
    },

    {
      outcome:
        "AWAY",

      probability:
        options
          .probabilities
          .away,
    },
  ];

  entries.sort(
    (
      left,
      right,
    ) =>
      right.probability -
      left.probability,
  );

  const highestProbability =
    entries[
      0
    ].probability;

  const secondProbability =
    entries[
      1
    ].probability;

  const probabilityGap =
    Math.max(
      0,

      highestProbability -
      secondProbability,
    );

  /*
   * Yaklaşık 35 puanlık ayrışmada
   * separation score maksimuma ulaşır.
   *
   * Ör:
   * 57 / 23 / 20
   * oldukça ayrışmış bir tahmindir.
   */
  const separationScore =
    round(
      clamp(
        (
          probabilityGap /
          35
        ) *
          100,
        0,
        100,
      ),
    );

  /*
   * %33.33 rastgele üçlü dağılım tabanı.
   *
   * %70+ Poisson tahmini bu bileşende
   * yaklaşık maksimum puana ulaşır.
   */
  const probabilityStrengthScore =
    round(
      clamp(
        (
          (
            highestProbability -
            33.33
          ) /
          36.67
        ) *
          100,
        0,
        100,
      ),
    );

  const leagueSampleScore =
    calculateSampleScore(
      options
        .goalModel
        .dataQuality
        .leagueMatches,
      80,
    );

  const homeVenueSampleScore =
    calculateSampleScore(
      options
        .goalModel
        .dataQuality
        .homeVenueMatches,
      8,
    );

  const awayVenueSampleScore =
    calculateSampleScore(
      options
        .goalModel
        .dataQuality
        .awayVenueMatches,
      8,
    );

  /*
   * Takım bazında en zayıf tarafın
   * confidence üzerinde güçlü etkisi
   * olmasını istiyoruz.
   */
  const venueSampleScore =
    round(
      homeVenueSampleScore *
        0.5 +
      awayVenueSampleScore *
        0.5,
    );

  /*
   * League geçmişi gerekli fakat
   * takım venue geçmişinden daha az
   * önemlidir.
   */
  const dataQualityScore =
    round(
      leagueSampleScore *
        0.3 +
      homeVenueSampleScore *
        0.35 +
      awayVenueSampleScore *
        0.35,
    );

  /*
   * Production confidence:
   *
   * %45 data quality
   * %35 probability separation
   * %20 top probability strength
   *
   * Bu sayede sadece %57 gördüğümüz için
   * HIGH / VERY_HIGH vermiyoruz.
   */
  const baseScore =
    dataQualityScore *
      0.45 +
    separationScore *
      0.35 +
    probabilityStrengthScore *
      0.2;

  let warningPenalty =
    0;

  const reasons:
    string[] =
      [];

  const leagueMatches =
    options
      .goalModel
      .dataQuality
      .leagueMatches;

  const homeVenueMatches =
    options
      .goalModel
      .dataQuality
      .homeVenueMatches;

  const awayVenueMatches =
    options
      .goalModel
      .dataQuality
      .awayVenueMatches;

  if (
    leagueMatches <
    10
  ) {
    warningPenalty +=
      12;

    reasons.push(
      `Lig geçmişi çok düşük (${leagueMatches} maç).`,
    );
  } else if (
    leagueMatches <
    20
  ) {
    warningPenalty +=
      6;

    reasons.push(
      `Lig geçmişi sınırlı (${leagueMatches} maç).`,
    );
  }

  if (
    homeVenueMatches ===
    0
  ) {
    warningPenalty +=
      12;

    reasons.push(
      "Ev sahibinin iç saha historical örneği yok.",
    );
  } else if (
    homeVenueMatches <
    3
  ) {
    warningPenalty +=
      7;

    reasons.push(
      `Ev sahibinin iç saha örneklemi çok düşük (${homeVenueMatches}).`,
    );
  } else if (
    homeVenueMatches <
    5
  ) {
    warningPenalty +=
      3;

    reasons.push(
      `Ev sahibinin iç saha örneklemi sınırlı (${homeVenueMatches}).`,
    );
  }

  if (
    awayVenueMatches ===
    0
  ) {
    warningPenalty +=
      12;

    reasons.push(
      "Deplasman takımının deplasman historical örneği yok.",
    );
  } else if (
    awayVenueMatches <
    3
  ) {
    warningPenalty +=
      7;

    reasons.push(
      `Deplasman örneklemi çok düşük (${awayVenueMatches}).`,
    );
  } else if (
    awayVenueMatches <
    5
  ) {
    warningPenalty +=
      3;

    reasons.push(
      `Deplasman örneklemi sınırlı (${awayVenueMatches}).`,
    );
  }

  /*
   * Decision Layer DRAW seçtiğinde
   * seçilen sonuç Poisson'un argmax sonucu
   * değildir.
   *
   * Bu katman historical olarak PASS aldı,
   * fakat doğal olarak confidence'ın biraz
   * düşmesi gerekir.
   */
  const drawOverridePenalty =
    options
      .drawDecision
      .applied
      ? 8
      : 0;

  if (
    options
      .drawDecision
      .applied
  ) {
    reasons.push(
      "DRAW Decision Layer argmax sonucunu değiştirdi; confidence kontrollü düşürüldü.",
    );
  }

  const score =
    round(
      clamp(
        baseScore -
          warningPenalty -
          drawOverridePenalty,
        0,
        100,
      ),
    );

  const selectedProbability =
    getOutcomeProbability(
      options.probabilities,
      options.finalOutcome,
    );

  if (
    reasons.length ===
    0
  ) {
    reasons.push(
      "Poisson historical veri kapsamı yeterli seviyededir.",
    );
  }

  if (
    probabilityGap >=
    20
  ) {
    reasons.push(
      `1X2 ayrışması güçlü: ${round(
        probabilityGap,
      )} puan.`,
    );
  } else if (
    probabilityGap >=
    10
  ) {
    reasons.push(
      `1X2 ayrışması orta: ${round(
        probabilityGap,
      )} puan.`,
    );
  } else {
    reasons.push(
      `1X2 ayrışması düşük: ${round(
        probabilityGap,
      )} puan.`,
    );
  }

  return {
    modelName:
      POISSON_CONFIDENCE_MODEL_NAME,

    modelVersion:
      POISSON_CONFIDENCE_MODEL_VERSION,

    score,

    level:
      getConfidenceLevel(
        score,
      ),

    predictedOutcome:
      options.finalOutcome,

    predictedProbability:
      selectedProbability,

    secondProbability:
      secondProbability,

    probabilityGap:
      round(
        probabilityGap,
      ),

    dataQualityScore,

    separationScore,

    probabilityStrengthScore,

    warningPenalty,

    drawOverridePenalty,

    components: {
      leagueSampleScore,

      homeVenueSampleScore,

      awayVenueSampleScore,

      venueSampleScore,

      probabilitySeparationScore:
        separationScore,

      probabilityStrengthScore,
    },

    dataQuality: {
      leagueMatches,

      homeVenueMatches,

      awayVenueMatches,

      minimumVenueMatches:
        options
          .goalModel
          .dataQuality
          .minimumVenueMatches,

      averageVenueMatches:
        options
          .goalModel
          .dataQuality
          .averageVenueMatches,
    },

    reasons,
  };
}