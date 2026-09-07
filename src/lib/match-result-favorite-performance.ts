import type {
  ProductionDashboardPrediction,
} from "@/lib/prediction-dashboard";

export type MatchResultFavoriteOutcome = "HOME" | "DRAW" | "AWAY";
export type MatchResultFavoriteSettlement = "WON" | "LOST" | "VOID";

export type MatchResultFavoriteRow = {
  id: number;
  matchId: number;
  leagueName: string;
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  selection: MatchResultFavoriteOutcome;
  probability: number;
  fairOdds: number;
  confidenceScore: number;
  homeScore: number | null;
  awayScore: number | null;
  result: MatchResultFavoriteSettlement;
};

export const MINIMUM_FAVORITE_PROBABILITY = 30;

function actualOutcome(
  homeScore: number,
  awayScore: number,
): MatchResultFavoriteOutcome {
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

function favoriteOutcome(
  prediction: ProductionDashboardPrediction,
): { outcome: MatchResultFavoriteOutcome; probability: number } {
  const outcomes = [
    { outcome: "HOME" as const, probability: prediction.homeProbability },
    { outcome: "DRAW" as const, probability: prediction.drawProbability },
    { outcome: "AWAY" as const, probability: prediction.awayProbability },
  ];

  return outcomes.reduce((favorite, candidate) =>
    candidate.probability > favorite.probability ? candidate : favorite,
  );
}

export function buildMatchResultFavoriteRows(
  predictions: readonly ProductionDashboardPrediction[],
  options: {
    from: Date;
    to: Date;
    minimumProbability?: number;
  },
): MatchResultFavoriteRow[] {
  const minimumProbability =
    options.minimumProbability ?? MINIMUM_FAVORITE_PROBABILITY;

  return predictions.flatMap((prediction) => {
    if (
      prediction.kickoffAt < options.from ||
      prediction.kickoffAt > options.to
    ) {
      return [];
    }

    const favorite = favoriteOutcome(prediction);

    if (favorite.probability < minimumProbability) {
      return [];
    }

    const homeScore = prediction.finalHomeScore ?? null;
    const awayScore = prediction.finalAwayScore ?? null;
    const isVoid = prediction.settlementStatus === "VOID";

    if (!isVoid && (homeScore === null || awayScore === null)) {
      return [];
    }

    const result: MatchResultFavoriteSettlement = isVoid
      ? "VOID"
      : actualOutcome(homeScore!, awayScore!) === favorite.outcome
        ? "WON"
        : "LOST";

    return [{
      id: prediction.matchId,
      matchId: prediction.matchId,
      leagueName: prediction.leagueName,
      kickoffAt: prediction.kickoffAt,
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      selection: favorite.outcome,
      probability: favorite.probability,
      fairOdds: 100 / favorite.probability,
      confidenceScore: prediction.confidenceScore,
      homeScore,
      awayScore,
      result,
    }];
  }).sort(
    (first, second) => second.kickoffAt.getTime() - first.kickoffAt.getTime(),
  );
}
