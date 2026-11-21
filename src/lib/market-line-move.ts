import { prisma } from "@/lib/prisma";

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

/**
 * Loads opening (earliest snapshot) vs current (latest snapshot) book odds
 * for pick selection keys (e.g. match_result_home, btts_yes).
 */
export async function loadMarketLineMoves(
  queries: MarketLineMoveQuery[],
): Promise<Map<string, MarketLineMove>> {
  const result = new Map<string, MarketLineMove>();
  const cleaned = queries
    .map((item) => ({
      matchId: item.matchId,
      selectionKey: item.selectionKey.trim(),
    }))
    .filter((item) => Number.isInteger(item.matchId) && item.matchId > 0 && item.selectionKey);

  if (!cleaned.length) return result;

  const matchIds = [...new Set(cleaned.map((item) => item.matchId))];
  const selectionKeys = [...new Set(cleaned.map((item) => item.selectionKey))];

  const rows = await prisma.oddsSelection.findMany({
    where: {
      OR: [
        { selectionKey: { in: selectionKeys } },
        { market: { marketKey: { in: selectionKeys } } },
      ],
      market: {
        snapshot: {
          matchId: { in: matchIds },
        },
      },
    },
    select: {
      selectionKey: true,
      decimalOdds: true,
      market: {
        select: {
          marketKey: true,
          snapshot: {
            select: {
              matchId: true,
              capturedAt: true,
            },
          },
        },
      },
    },
  });

  type Point = { odds: number; at: number };
  const byKey = new Map<string, { first: Point; last: Point }>();

  for (const row of rows) {
    const matchId = row.market.snapshot.matchId;
    const at = row.market.snapshot.capturedAt.getTime();
    const odds = row.decimalOdds;
    if (!Number.isFinite(odds) || odds <= 1) continue;

    const aliases = new Set<string>([
      marketLineMoveKey(matchId, row.selectionKey),
      marketLineMoveKey(matchId, row.market.marketKey),
    ]);

    for (const key of aliases) {
      const point = { odds, at };
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, { first: point, last: point });
        continue;
      }
      if (at < current.first.at) current.first = point;
      if (at > current.last.at) current.last = point;
    }
  }

  for (const query of cleaned) {
    const key = marketLineMoveKey(query.matchId, query.selectionKey);
    const span = byKey.get(key);
    if (!span) continue;
    const move = buildMarketLineMove(span.first.odds, span.last.odds);
    if (move) result.set(key, move);
  }

  return result;
}

export function marketLineMovesToRecord(
  moves: Map<string, MarketLineMove>,
): Record<string, MarketLineMove> {
  return Object.fromEntries(moves.entries());
}
