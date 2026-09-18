import type {
  PopularMarketRow,
} from "@/modules/market-engine/build-popular-markets-summary";

export type PredictionOutcome =
  | "HOME"
  | "DRAW"
  | "AWAY";

export type UiConfidence =
  | "Very High"
  | "High"
  | "Medium"
  | "Low"
  | "Very Low";

export type DashboardDataMode =
  | "LIVE"
  | "PREVIEW";

export type PredictionSettlementStatus =
  | "PENDING"
  | "WON"
  | "LOST"
  | "VOID";

export type PredictionReasonTone =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL";

export type PredictionReason = {
  label: string;
  description: string;
  tone: PredictionReasonTone;
};

export type DashboardTopPick = {
  rank: number;

  key: string;

  category: string;

  market: string;
  selection: string;

  probability: number;
  fairOdds: number | null;

  reliabilityScore: number;
  pickScore: number;

  historicalHitRate: number | null;
  historicalSamples: number;

  thresholdHitRate: number | null;
  thresholdSamples: number;

  tier:
    | "VERY_HIGH"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  reasons: string[];
};

export type DashboardPrediction = {
  matchId: number;
  kickoffAt: Date;

  dataMode:
    DashboardDataMode;

  leagueApiId: number;
  leagueName: string;

  homeTeam: string;
  awayTeam: string;

  homeTeamId?: number;
  awayTeamId?: number;

  homeTeamLogo: string | null;
  awayTeamLogo: string | null;

  homeRecentResults?: ("W" | "D" | "L")[];
  awayRecentResults?: ("W" | "D" | "L")[];

  popularMarketsSummary?: PopularMarketRow[];

  homeProbability: number;
  drawProbability: number;
  awayProbability: number;

  predictedOutcome:
    PredictionOutcome;

  predictedProbability: number;

  confidenceScore: number;
  confidenceLevel: string;

  expectedHomeGoals: number;
expectedAwayGoals: number;

  /**
   * These fields are populated by Prediction Archive.
   * They remain optional for compatibility with older records.
   */
  settlementStatus?:
    PredictionSettlementStatus;

  finalHomeScore?:
    number | null;

  finalAwayScore?:
    number | null;

popularPicks:
  DashboardTopPick[];

topPicks:
  DashboardTopPick[];

marketCount: number;

  homeRating: number | null;
  awayRating: number | null;

  homeAttack: number | null;
  awayAttack: number | null;

  homeDefense: number | null;
  awayDefense: number | null;

  homeForm: number | null;
  awayForm: number | null;

  homeFitness: number | null;
  awayFitness: number | null;

  ratingDifference: number | null;
  ratingEdge: string;

  warnings: string[];
};

export function getPredictionLabel(
  prediction:
    DashboardPrediction,
): string {
  const topPick =
    prediction.topPicks[0];

  if (topPick) {
    return `${topPick.market} • ${topPick.selection}`;
  }

  if (
    prediction.predictedOutcome ===
    "HOME"
  ) {
    return `${prediction.homeTeam} to win`;
  }

  if (
    prediction.predictedOutcome ===
    "AWAY"
  ) {
    return `${prediction.awayTeam} to win`;
  }

  return "Draw";
}

export function getUiConfidence(
  score: number,
): UiConfidence {
  if (
    score >=
    80
  ) {
    return "Very High";
  }

  if (
    score >=
    70
  ) {
    return "High";
  }

  if (
    score >=
    60
  ) {
    return "Medium";
  }

  if (
    score >=
    50
  ) {
    return "Low";
  }

  return "Very Low";
}

export function getTopPickReliability(
  prediction:
    DashboardPrediction,
): number {
  return (
    prediction.topPicks[0]
      ?.reliabilityScore ??
    prediction.confidenceScore
  );
}
function createDifferenceReason(
  options: {
    label: string;

    homeValue:
      number | null;

    awayValue:
      number | null;

    homeTeam:
      string;

    awayTeam:
      string;

    minimumDifference?:
      number;
  },
): PredictionReason | null {
  const {
    label,
    homeValue,
    awayValue,
    homeTeam,
    awayTeam,
    minimumDifference = 5,
  } = options;

  if (
    homeValue === null ||
    awayValue === null
  ) {
    return null;
  }

  const difference =
    homeValue -
    awayValue;

  if (
    Math.abs(difference) <
    minimumDifference
  ) {
    return {
      label,

      description:
        `The teams are closely matched in ${label.toLowerCase()}.`,

      tone:
        "NEUTRAL",
    };
  }

  if (difference > 0) {
    return {
      label,

      description:
        `${homeTeam} is stronger than ${awayTeam} in ${label.toLowerCase()}.`,

      tone:
        "POSITIVE",
    };
  }

  return {
    label,

    description:
      `${awayTeam} is stronger than ${homeTeam} in ${label.toLowerCase()}.`,

    tone:
      "NEGATIVE",
  };
}

export function getPredictionReasons(
  prediction:
    DashboardPrediction,
): PredictionReason[] {
  const reasons:
    PredictionReason[] = [];

  const topPick =
    prediction.topPicks[0];

  if (topPick) {
    reasons.push({
      label:
        "Top Pick",

      description:
        `${topPick.market} • ${topPick.selection} has a model probability of ${topPick.probability.toFixed(
          1,
        )}% and reliability ${topPick.reliabilityScore.toFixed(
          0,
        )}/100.`,

      tone:
        topPick.reliabilityScore >=
        80
          ? "POSITIVE"
          : "NEUTRAL",
    });
  }

  const comparisons = [
    createDifferenceReason({
      label:
        "Overall Strength",

      homeValue:
        prediction.homeRating,

      awayValue:
        prediction.awayRating,

      homeTeam:
        prediction.homeTeam,

      awayTeam:
        prediction.awayTeam,

      minimumDifference:
        7,
    }),

    createDifferenceReason({
      label:
        "Form",

      homeValue:
        prediction.homeForm,

      awayValue:
        prediction.awayForm,

      homeTeam:
        prediction.homeTeam,

      awayTeam:
        prediction.awayTeam,

      minimumDifference:
        8,
    }),

    createDifferenceReason({
      label:
        "Attack",

      homeValue:
        prediction.homeAttack,

      awayValue:
        prediction.awayAttack,

      homeTeam:
        prediction.homeTeam,

      awayTeam:
        prediction.awayTeam,

      minimumDifference:
        8,
    }),

    createDifferenceReason({
      label:
        "Defense",

      homeValue:
        prediction.homeDefense,

      awayValue:
        prediction.awayDefense,

      homeTeam:
        prediction.homeTeam,

      awayTeam:
        prediction.awayTeam,

      minimumDifference:
        8,
    }),
  ];

  for (
    const comparison
    of comparisons
  ) {
    if (comparison) {
      reasons.push(
        comparison,
      );
    }
  }

  return reasons;
}

export function getPredictionSummary(
  prediction:
    DashboardPrediction,
): string {
  const topPick =
    prediction.topPicks[0];

  if (topPick) {
    return (
      `The strongest market signal for this match is ${topPick.market} • ${topPick.selection}. ` +
      `Model probability is ${topPick.probability.toFixed(
        1,
      )}% and historical reliability is ${topPick.reliabilityScore.toFixed(
        0,
      )}/100.`
    );
  }

  return (
    `No Top Pick met the quality threshold for ${prediction.homeTeam} vs ${prediction.awayTeam}.`
  );
}
