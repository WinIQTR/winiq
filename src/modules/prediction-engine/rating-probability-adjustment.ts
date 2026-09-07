import type {
  OutcomeProbabilities,
} from "@/modules/probability-engine";

import type {
  MatchRatingEdge,
  MatchRatingResult,
} from "@/modules/rating-engine";

export type RatingProbabilityAdjustmentStatus =
  | "APPLIED"
  | "SKIPPED_INSUFFICIENT_DATA"
  | "SKIPPED_LOW_CONFIDENCE"
  | "SKIPPED_BALANCED";

export type RatingProbabilityAdjustmentResult = {
  status:
    RatingProbabilityAdjustmentStatus;

  baseProbabilities:
    OutcomeProbabilities;

  adjustedProbabilities:
    OutcomeProbabilities;

  ratingDifference:
    number | null;

  ratingConfidenceScore:
    number;

  ratingEdge:
    MatchRatingEdge;

  theoreticalShift:
    number;

  appliedHomeShift:
    number;

  appliedDrawShift:
    number;

  appliedAwayShift:
    number;

  maximumAllowedShift:
    number;

  message:
    string;
};

const MAXIMUM_PROBABILITY_SHIFT =
  8;

const FULL_STRENGTH_RATING_DIFFERENCE =
  20;

const MINIMUM_RATING_CONFIDENCE =
  30;

const MINIMUM_MEANINGFUL_DIFFERENCE =
  2;

const MINIMUM_OUTCOME_PROBABILITY =
  1;

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

function normalizeProbabilities(
  probabilities:
    OutcomeProbabilities,
): OutcomeProbabilities {
  const home =
    Math.max(
      probabilities.home,
      MINIMUM_OUTCOME_PROBABILITY,
    );

  const draw =
    Math.max(
      probabilities.draw,
      MINIMUM_OUTCOME_PROBABILITY,
    );

  const away =
    Math.max(
      probabilities.away,
      MINIMUM_OUTCOME_PROBABILITY,
    );

  const total =
    home +
    draw +
    away;

  if (
    !Number.isFinite(
      total,
    ) ||
    total <= 0
  ) {
    return {
      home:
        33.33,

      draw:
        33.34,

      away:
        33.33,
    };
  }

  const normalizedHome =
    round(
      (
        home /
        total
      ) *
        100,
    );

  const normalizedDraw =
    round(
      (
        draw /
        total
      ) *
        100,
    );

  const normalizedAway =
    round(
      100 -
        normalizedHome -
        normalizedDraw,
    );

  return {
    home:
      normalizedHome,

    draw:
      normalizedDraw,

    away:
      normalizedAway,
  };
}

function createSkippedResult(
  options: {
    status:
      RatingProbabilityAdjustmentStatus;

    probabilities:
      OutcomeProbabilities;

    rating:
      MatchRatingResult;

    message:
      string;
  },
): RatingProbabilityAdjustmentResult {
  const normalized =
    normalizeProbabilities(
      options.probabilities,
    );

  return {
    status:
      options.status,

    baseProbabilities:
      normalized,

    adjustedProbabilities:
      normalized,

    ratingDifference:
      options
        .rating
        .ratingDifference,

    ratingConfidenceScore:
      options
        .rating
        .combinedConfidenceScore,

    ratingEdge:
      options
        .rating
        .edge,

    theoreticalShift:
      0,

    appliedHomeShift:
      0,

    appliedDrawShift:
      0,

    appliedAwayShift:
      0,

    maximumAllowedShift:
      MAXIMUM_PROBABILITY_SHIFT,

    message:
      options.message,
  };
}

export function applyRatingProbabilityAdjustment(
  options: {
    probabilities:
      OutcomeProbabilities;

    rating:
      MatchRatingResult;
  },
): RatingProbabilityAdjustmentResult {
  const baseProbabilities =
    normalizeProbabilities(
      options.probabilities,
    );

  const ratingDifference =
    options
      .rating
      .ratingDifference;

  const ratingConfidenceScore =
    options
      .rating
      .combinedConfidenceScore;

  if (
    ratingDifference ===
      null ||
    options.rating.edge ===
      "INSUFFICIENT_DATA"
  ) {
    return createSkippedResult({
      status:
        "SKIPPED_INSUFFICIENT_DATA",

      probabilities:
        baseProbabilities,

      rating:
        options.rating,

      message:
        "Rating farkı üretilemediği için olasılıklar değiştirilmedi.",
    });
  }

  if (
    ratingConfidenceScore <
    MINIMUM_RATING_CONFIDENCE
  ) {
    return createSkippedResult({
      status:
        "SKIPPED_LOW_CONFIDENCE",

      probabilities:
        baseProbabilities,

      rating:
        options.rating,

      message:
        `Rating güveni ${MINIMUM_RATING_CONFIDENCE} puanın altında olduğu için düzeltme uygulanmadı.`,
    });
  }

  if (
    Math.abs(
      ratingDifference,
    ) <
    MINIMUM_MEANINGFUL_DIFFERENCE
  ) {
    return createSkippedResult({
      status:
        "SKIPPED_BALANCED",

      probabilities:
        baseProbabilities,

      rating:
        options.rating,

      message:
        "Rating farkı anlamlı düzeltme eşiğinin altında.",
    });
  }

  /*
   * Rating farkı -20 ile +20 arasında
   * normalize edilir.
   *
   * +1: güçlü ev sahibi üstünlüğü
   * -1: güçlü deplasman üstünlüğü
   */
  const normalizedRatingStrength =
    clamp(
      ratingDifference /
        FULL_STRENGTH_RATING_DIFFERENCE,
      -1,
      1,
    );

  /*
   * Rating güveni 30 olduğunda etki 0,
   * 100 olduğunda etki tam güçtedir.
   */
  const confidenceMultiplier =
    clamp(
      (
        ratingConfidenceScore -
        MINIMUM_RATING_CONFIDENCE
      ) /
        (
          100 -
          MINIMUM_RATING_CONFIDENCE
        ),
      0,
      1,
    );

  const theoreticalShift =
    round(
      MAXIMUM_PROBABILITY_SHIFT *
        normalizedRatingStrength *
        confidenceMultiplier,
    );

  /*
   * Rating üstünlüğü:
   *
   * %70 doğrudan karşı tarafın kazanma
   * ihtimalinden alınır.
   *
   * %30 beraberlik ihtimalinden alınır.
   *
   * Böylece beraberlik tamamen yok edilmez.
   */
  const homeShift =
    theoreticalShift;

  const awayShift =
    theoreticalShift >
    0
      ? -Math.abs(
          theoreticalShift,
        ) *
          0.7
      : Math.abs(
          theoreticalShift,
        ) *
          0.7;

  const drawShift =
    theoreticalShift >
    0
      ? -Math.abs(
          theoreticalShift,
        ) *
          0.3
      : -Math.abs(
          theoreticalShift,
        ) *
          0.3;

  /*
   * Negatif theoreticalShift durumunda
   * deplasman tarafı güçlendirilir.
   */
  const adjustedBeforeNormalization =
    theoreticalShift >
    0
      ? {
          home:
            baseProbabilities.home +
            Math.abs(
              homeShift,
            ),

          draw:
            baseProbabilities.draw +
            drawShift,

          away:
            baseProbabilities.away +
            awayShift,
        }
      : {
          home:
            baseProbabilities.home -
            Math.abs(
              theoreticalShift,
            ) *
              0.7,

          draw:
            baseProbabilities.draw +
            drawShift,

          away:
            baseProbabilities.away +
            Math.abs(
              theoreticalShift,
            ),
        };

  const adjustedProbabilities =
    normalizeProbabilities(
      adjustedBeforeNormalization,
    );

  return {
    status:
      "APPLIED",

    baseProbabilities,

    adjustedProbabilities,

    ratingDifference,

    ratingConfidenceScore,

    ratingEdge:
      options
        .rating
        .edge,

    theoreticalShift,

    appliedHomeShift:
      round(
        adjustedProbabilities.home -
          baseProbabilities.home,
      ),

    appliedDrawShift:
      round(
        adjustedProbabilities.draw -
          baseProbabilities.draw,
      ),

    appliedAwayShift:
      round(
        adjustedProbabilities.away -
          baseProbabilities.away,
      ),

    maximumAllowedShift:
      MAXIMUM_PROBABILITY_SHIFT,

    message:
      theoreticalShift >
      0
        ? "Rating Engine ev sahibi olasılığını kontrollü biçimde yükseltti."
        : "Rating Engine deplasman olasılığını kontrollü biçimde yükseltti.",
  };
}