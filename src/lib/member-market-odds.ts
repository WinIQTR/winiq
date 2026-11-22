import { prisma } from "@/lib/prisma";

export function marketOddsPickKey(matchId: number, marketKey: string): string {
  return `${matchId}|${marketKey}`;
}

/**
 * Best-effort book/line decimal odds for published smart picks.
 * Prefers ValueBetHistory.bestOdds, then latest OddsSelection by selectionKey.
 * Does not fall back to fair/model odds — callers do that.
 */
export async function loadMarketOddsByPickKey(
  queries: ReadonlyArray<{ matchId: number; marketKey: string }>,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const cleaned = queries
    .map((item) => ({
      matchId: item.matchId,
      marketKey: item.marketKey.trim(),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.matchId) &&
        item.matchId > 0 &&
        item.marketKey.length > 0,
    );
  if (!cleaned.length) return result;

  const matchIds = [...new Set(cleaned.map((item) => item.matchId))];
  const marketKeys = [...new Set(cleaned.map((item) => item.marketKey))];

  const valueRows = await prisma.valueBetHistory.findMany({
    where: {
      matchId: { in: matchIds },
      marketKey: { in: marketKeys },
      bestOdds: { gt: 1 },
    },
    select: { matchId: true, marketKey: true, bestOdds: true },
  });
  for (const row of valueRows) {
    const key = marketOddsPickKey(row.matchId, row.marketKey);
    const prev = result.get(key);
    if (prev == null || row.bestOdds > prev) result.set(key, row.bestOdds);
  }

  const missingKeys = cleaned
    .map((item) => marketOddsPickKey(item.matchId, item.marketKey))
    .filter((key) => !result.has(key));
  if (!missingKeys.length) return result;

  const missingMatchIds = [
    ...new Set(missingKeys.map((key) => Number(key.split("|")[0]))),
  ];
  const missingMarketKeys = [
    ...new Set(missingKeys.map((key) => key.slice(key.indexOf("|") + 1))),
  ];

  const bookRows = await prisma.oddsSelection.findMany({
    where: {
      selectionKey: { in: missingMarketKeys },
      decimalOdds: { gt: 1 },
      market: {
        snapshot: {
          matchId: { in: missingMatchIds },
        },
      },
    },
    select: {
      selectionKey: true,
      decimalOdds: true,
      market: {
        select: {
          snapshot: {
            select: { matchId: true, capturedAt: true },
          },
        },
      },
    },
  });

  const latest = new Map<string, { odds: number; at: number }>();
  for (const row of bookRows) {
    const matchId = row.market.snapshot.matchId;
    const key = marketOddsPickKey(matchId, row.selectionKey);
    const at = row.market.snapshot.capturedAt.getTime();
    const prev = latest.get(key);
    if (
      !prev ||
      at > prev.at ||
      (at === prev.at && row.decimalOdds > prev.odds)
    ) {
      latest.set(key, { odds: row.decimalOdds, at });
    }
  }
  for (const [key, value] of latest) {
    if (!result.has(key)) result.set(key, value.odds);
  }

  return result;
}
