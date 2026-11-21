import { prisma } from "@/lib/prisma";
import {
  buildMarketLineMove,
  marketLineMoveKey,
  type MarketLineMove,
  type MarketLineMoveQuery,
} from "@/lib/market-line-move-shared";

export type {
  MarketLineDirection,
  MarketLineMove,
  MarketLineMoveQuery,
} from "@/lib/market-line-move-shared";
export {
  buildMarketLineMove,
  classifyMarketLineMove,
  marketLineMoveKey,
  marketLineMovesToRecord,
} from "@/lib/market-line-move-shared";

/**
 * Loads opening (earliest snapshot) vs current (latest snapshot) book odds
 * for pick selection keys (e.g. match_result_home, btts_yes).
 * Server-only — do not import this module from client components.
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
