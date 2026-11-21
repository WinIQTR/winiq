export type MarketLineDirection = "up" | "down" | "flat";

export type MarketLineMove = {
  openingOdds: number;
  currentOdds: number;
  direction: MarketLineDirection;
  delta: number;
};

export type MarketLineMoveQuery = {
  matchId: number;
  selectionKey: string;
};

const FLAT_EPSILON = 0.005;

export function marketLineMoveKey(matchId: number, selectionKey: string): string {
  return `${matchId}:${selectionKey}`;
}

export function classifyMarketLineMove(
  openingOdds: number,
  currentOdds: number,
  epsilon = FLAT_EPSILON,
): MarketLineDirection {
  const delta = currentOdds - openingOdds;
  if (!Number.isFinite(delta) || Math.abs(delta) < epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

export function buildMarketLineMove(
  openingOdds: number,
  currentOdds: number,
): MarketLineMove | null {
  if (
    !Number.isFinite(openingOdds) ||
    !Number.isFinite(currentOdds) ||
    openingOdds <= 1 ||
    currentOdds <= 1
  ) {
    return null;
  }
  const direction = classifyMarketLineMove(openingOdds, currentOdds);
  return {
    openingOdds,
    currentOdds,
    direction,
    delta: Number((currentOdds - openingOdds).toFixed(4)),
  };
}

export function marketLineMovesToRecord(
  moves: Map<string, MarketLineMove>,
): Record<string, MarketLineMove> {
  return Object.fromEntries(moves.entries());
}
