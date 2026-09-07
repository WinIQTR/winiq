import type {
  MatchOutcome,
  OutcomeProbabilities,
} from "@/modules/probability-engine";

export type DrawDecisionLayerConfig = {
  minimumDrawProbability:
    number;

  maximumDrawGap:
    number;
};

export type DrawDecisionLayerStatus =
  | "BASELINE"
  | "DRAW_ALREADY_HIGHEST"
  | "DRAW_OVERRIDE";

export type DrawDecisionLayerResult = {
  modelName:
    string;

  modelVersion:
    string;

  status:
    DrawDecisionLayerStatus;

  applied:
    boolean;

  baselineOutcome:
    MatchOutcome;

  selectedOutcome:
    MatchOutcome;

  selectedProbability:
    number;

  drawProbability:
    number;

  strongestNonDrawProbability:
    number;

  drawGap:
    number;

  configuration:
    DrawDecisionLayerConfig;

  message:
    string;
};

/*
 * Bağımsız chronological holdout:
 *
 * Train      %60
 * Validation %20
 * Test       %20
 *
 * Final independent test:
 *
 * minDraw = 23
 * maxGap  = 14
 *
 * Accuracy        %51.23
 * DRAW Recall     %20.71
 * DRAW Precision  %32.58
 *
 * Production gate: PASS
 */
export const PRODUCTION_DRAW_DECISION_CONFIG:
  Readonly<
    DrawDecisionLayerConfig
  > = {
  minimumDrawProbability:
    23,

  maximumDrawGap:
    14,
};

export const DRAW_DECISION_MODEL_NAME =
  "poisson-draw-decision-layer";

export const DRAW_DECISION_MODEL_VERSION =
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

function determineArgmaxOutcome(
  probabilities:
    OutcomeProbabilities,
): MatchOutcome {
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

function validateProbabilities(
  probabilities:
    OutcomeProbabilities,
): void {
  const values = [
    probabilities.home,
    probabilities.draw,
    probabilities.away,
  ];

  if (
    values.some(
      (
        value,
      ) =>
        !Number.isFinite(
          value,
        ) ||
        value <
          0,
    )
  ) {
    throw new Error(
      "DRAW Decision Layer geçerli HOME/DRAW/AWAY olasılıkları gerektirir.",
    );
  }

  const total =
    values.reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    );

  if (
    total <=
    0
  ) {
    throw new Error(
      "DRAW Decision Layer olasılık toplamı sıfır olamaz.",
    );
  }
}

function validateConfiguration(
  configuration:
    DrawDecisionLayerConfig,
): void {
  if (
    !Number.isFinite(
      configuration
        .minimumDrawProbability,
    ) ||
    configuration
      .minimumDrawProbability <
      0 ||
    configuration
      .minimumDrawProbability >
      100
  ) {
    throw new Error(
      "minimumDrawProbability 0-100 arasında olmalıdır.",
    );
  }

  if (
    !Number.isFinite(
      configuration
        .maximumDrawGap,
    ) ||
    configuration
      .maximumDrawGap <
      0 ||
    configuration
      .maximumDrawGap >
      100
  ) {
    throw new Error(
      "maximumDrawGap 0-100 arasında olmalıdır.",
    );
  }
}

export function applyDrawDecisionLayer(
  options: {
    probabilities:
      OutcomeProbabilities;

    configuration?:
      DrawDecisionLayerConfig;
  },
): DrawDecisionLayerResult {
  const configuration =
    options.configuration ??
    PRODUCTION_DRAW_DECISION_CONFIG;

  validateProbabilities(
    options.probabilities,
  );

  validateConfiguration(
    configuration,
  );

  const baselineOutcome =
    determineArgmaxOutcome(
      options.probabilities,
    );

  const drawProbability =
    options
      .probabilities
      .draw;

  const strongestNonDrawProbability =
    Math.max(
      options
        .probabilities
        .home,

      options
        .probabilities
        .away,
    );

  const drawGap =
    round(
      strongestNonDrawProbability -
        drawProbability,
    );

  /*
   * DRAW zaten en yüksek olasılıksa
   * Decision Layer müdahale etmez.
   */
  if (
    baselineOutcome ===
    "DRAW"
  ) {
    return {
      modelName:
        DRAW_DECISION_MODEL_NAME,

      modelVersion:
        DRAW_DECISION_MODEL_VERSION,

      status:
        "DRAW_ALREADY_HIGHEST",

      applied:
        false,

      baselineOutcome,

      selectedOutcome:
        "DRAW",

      selectedProbability:
        drawProbability,

      drawProbability,

      strongestNonDrawProbability,

      drawGap,

      configuration,

      message:
        "DRAW zaten Poisson modelindeki en yüksek 1X2 olasılığıdır.",
    };
  }

  const shouldOverrideToDraw =
    drawProbability >=
      configuration
        .minimumDrawProbability &&
    drawGap <=
      configuration
        .maximumDrawGap;

  if (
    shouldOverrideToDraw
  ) {
    return {
      modelName:
        DRAW_DECISION_MODEL_NAME,

      modelVersion:
        DRAW_DECISION_MODEL_VERSION,

      status:
        "DRAW_OVERRIDE",

      applied:
        true,

      baselineOutcome,

      selectedOutcome:
        "DRAW",

      selectedProbability:
        drawProbability,

      drawProbability,

      strongestNonDrawProbability,

      drawGap,

      configuration,

      message:
        [
          "Poisson DRAW olasılığı production threshold koşullarını geçti.",
          `DRAW %${round(
            drawProbability,
          )}.`,
          `Gap ${drawGap}.`,
        ].join(
          " ",
        ),
    };
  }

  return {
    modelName:
      DRAW_DECISION_MODEL_NAME,

    modelVersion:
      DRAW_DECISION_MODEL_VERSION,

    status:
      "BASELINE",

    applied:
      false,

    baselineOutcome,

    selectedOutcome:
      baselineOutcome,

    selectedProbability:
      getOutcomeProbability(
        options.probabilities,
        baselineOutcome,
      ),

    drawProbability,

    strongestNonDrawProbability,

    drawGap,

    configuration,

    message:
      "DRAW override koşulları oluşmadı; Poisson argmax sonucu korundu.",
  };
}