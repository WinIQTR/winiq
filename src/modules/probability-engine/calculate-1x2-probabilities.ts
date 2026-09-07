import { calculateMatchRating } from "@/modules/rating-engine";

import type {
  FairOdds,
  MatchOutcome,
  MatchProbabilityResult,
  OutcomeProbabilities,
  ProbabilityConfidenceLevel,
} from "./types";

/**
 * İlk sürüm parametreleri.
 *
 * Bunlar nihai değerler değildir.
 * 380 maçlık backtest sonrasında kalibre edilecektir.
 */
const HOME_ADVANTAGE_RATING = 4.5;
const RATING_SCALE = 12;
const BASE_DRAW_PROBABILITY = 0.27;
const MIN_DRAW_PROBABILITY = 0.16;
const MAX_DRAW_PROBABILITY = 0.31;

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

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function normalizeProbabilities(options: {
  home: number;
  draw: number;
  away: number;
}): OutcomeProbabilities {
  const total =
    options.home +
    options.draw +
    options.away;

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
    (options.home / total) * 100;

  const draw =
    (options.draw / total) * 100;

  /*
   * Yuvarlama sonrası toplamın tam 100 olması için
   * away değeri kalan yüzdeden hesaplanır.
   */
  const roundedHome = round(home);
  const roundedDraw = round(draw);

  const roundedAway = round(
    100 -
      roundedHome -
      roundedDraw,
  );

  return {
    home: roundedHome,
    draw: roundedDraw,
    away: roundedAway,
  };
}

function probabilityToFairOdds(
  probabilityPercentage: number,
): number {
  if (
    !Number.isFinite(probabilityPercentage) ||
    probabilityPercentage <= 0
  ) {
    return 999;
  }

  return round(
    100 / probabilityPercentage,
  );
}

function createFairOdds(
  probabilities: OutcomeProbabilities,
): FairOdds {
  return {
    home: probabilityToFairOdds(
      probabilities.home,
    ),

    draw: probabilityToFairOdds(
      probabilities.draw,
    ),

    away: probabilityToFairOdds(
      probabilities.away,
    ),
  };
}

function getPredictedOutcome(
  probabilities: OutcomeProbabilities,
): {
  outcome: MatchOutcome;
  probability: number;
} {
  const outcomes: Array<{
    outcome: MatchOutcome;
    probability: number;
  }> = [
    {
      outcome: "HOME",
      probability:
        probabilities.home,
    },

    {
      outcome: "DRAW",
      probability:
        probabilities.draw,
    },

    {
      outcome: "AWAY",
      probability:
        probabilities.away,
    },
  ];

  outcomes.sort(
    (first, second) =>
      second.probability -
      first.probability,
  );

  return outcomes[0];
}

function getConfidenceLevel(
  score: number,
): ProbabilityConfidenceLevel {
  if (score >= 85) {
    return "VERY_HIGH";
  }

  if (score >= 70) {
    return "HIGH";
  }

  if (score >= 55) {
    return "MEDIUM";
  }

  if (score >= 40) {
    return "LOW";
  }

  return "VERY_LOW";
}

function calculateDrawProbability(
  adjustedDifference: number,
): number {
  /*
   * Takımların ratingleri birbirine yaklaştıkça
   * beraberlik ihtimali yükselir.
   *
   * Fark büyüdükçe beraberlik ihtimali azalır.
   */
  const absoluteDifference =
    Math.abs(adjustedDifference);

  const drawReduction =
    absoluteDifference * 0.006;

  return clamp(
    BASE_DRAW_PROBABILITY -
      drawReduction,
    MIN_DRAW_PROBABILITY,
    MAX_DRAW_PROBABILITY,
  );
}

function calculateProbabilities(
  adjustedDifference: number,
): OutcomeProbabilities {
  const drawProbability =
    calculateDrawProbability(
      adjustedDifference,
    );

  /*
   * Beraberlik dışındaki olasılık havuzu.
   */
  const decisiveProbability =
    1 - drawProbability;

  /*
   * Pozitif değer ev sahibi lehine,
   * negatif değer deplasman lehinedir.
   */
  const homeShare = logistic(
    adjustedDifference /
      RATING_SCALE,
  );

  const homeProbability =
    decisiveProbability *
    homeShare;

  const awayProbability =
    decisiveProbability *
    (1 - homeShare);

  return normalizeProbabilities({
    home: homeProbability,
    draw: drawProbability,
    away: awayProbability,
  });
}

function calculateProbabilityConfidence(options: {
  ratingConfidence: number;
  adjustedDifference: number;
  predictedProbability: number;
}): number {
  const ratingConfidence =
    clamp(
      options.ratingConfidence,
      0,
      100,
    );

  /*
   * Rating farkı belirginleştikçe karar gücü artar.
   * 25 rating farkında maksimum fark puanına ulaşır.
   */
  const differenceStrength =
    clamp(
      (
        Math.abs(
          options.adjustedDifference,
        ) / 25
      ) * 100,
      0,
      100,
    );

  /*
   * En yüksek sonuç olasılığı %33'e yakınsa karar
   * belirsizdir; yükseldikçe tahmin ayrışır.
   */
  const probabilitySeparation =
    clamp(
      (
        (
          options.predictedProbability -
          33.33
        ) /
        41.67
      ) * 100,
      0,
      100,
    );

  return round(
    ratingConfidence * 0.65 +
      differenceStrength * 0.2 +
      probabilitySeparation * 0.15,
  );
}

export async function calculate1x2Probabilities(
  matchId: number,
): Promise<MatchProbabilityResult> {
  if (
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const rating =
    await calculateMatchRating(matchId);

  const warnings: string[] = [];

  if (
    rating.home.overall === null ||
    rating.away.overall === null ||
    rating.ratingDifference === null
  ) {
    warnings.push(
      "Takımlardan en az biri için yeterli rating verisi bulunamadı.",
    );

    const probabilities: OutcomeProbabilities = {
      home: 33.33,
      draw: 33.34,
      away: 33.33,
    };

    return {
      match: rating.match,

      model: {
        name: "rating-logistic-v0.1",
        version: "0.1",
        isCalibrated: false,
      },

      rating: {
        homeOverall:
          rating.home.overall,
        awayOverall:
          rating.away.overall,
        rawDifference:
          rating.ratingDifference,
        homeAdvantage:
          HOME_ADVANTAGE_RATING,
        adjustedDifference: null,
        ratingEdge: rating.edge,
      },

      probabilities,
      fairOdds:
        createFairOdds(probabilities),

      predictedOutcome: null,
      predictedProbability: null,

      confidenceScore: 0,
      confidenceLevel: "VERY_LOW",

      warnings,
    };
  }

  const adjustedDifference = round(
    rating.ratingDifference +
      HOME_ADVANTAGE_RATING,
  );

  const probabilities =
    calculateProbabilities(
      adjustedDifference,
    );

  const prediction =
    getPredictedOutcome(
      probabilities,
    );

  const confidenceScore =
    calculateProbabilityConfidence({
      ratingConfidence:
        rating.combinedConfidenceScore,

      adjustedDifference,

      predictedProbability:
        prediction.probability,
    });

  const homeMissingFeatureCount =
  rating.home.categories.reduce(
    (total, category) =>
      total + category.missingFeatureCount,
    0,
  );

const awayMissingFeatureCount =
  rating.away.categories.reduce(
    (total, category) =>
      total + category.missingFeatureCount,
    0,
  );

if (
  homeMissingFeatureCount > 0 ||
  awayMissingFeatureCount > 0
) {
  warnings.push(
    `Bazı feature değerleri eksiktir. Ev sahibi: ${homeMissingFeatureCount}, deplasman: ${awayMissingFeatureCount}.`,
  );
}

  warnings.push(
    "Bu v0.1 olasılık modeli henüz geçmiş sonuçlarla kalibre edilmemiştir.",
  );

  return {
    match: rating.match,

    model: {
      name: "rating-logistic-v0.1",
      version: "0.1",
      isCalibrated: false,
    },

    rating: {
      homeOverall:
        rating.home.overall,

      awayOverall:
        rating.away.overall,

      rawDifference:
        rating.ratingDifference,

      homeAdvantage:
        HOME_ADVANTAGE_RATING,

      adjustedDifference,

      ratingEdge: rating.edge,
    },

    probabilities,

    fairOdds:
      createFairOdds(probabilities),

    predictedOutcome:
      prediction.outcome,

    predictedProbability:
      prediction.probability,

    confidenceScore,

    confidenceLevel:
      getConfidenceLevel(
        confidenceScore,
      ),

    warnings,
  };
}