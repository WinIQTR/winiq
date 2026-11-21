import type { DashboardPrediction } from "@/lib/prediction-dashboard-shared";
import type { MarketLineMoveQuery } from "@/lib/market-line-move-shared";

/** Collect selection keys to resolve book line moves for member boards. */
export function collectMarketLineMoveQueries(
  predictions: DashboardPrediction[],
): MarketLineMoveQuery[] {
  const seen = new Set<string>();
  const queries: MarketLineMoveQuery[] = [];

  for (const prediction of predictions) {
    for (const pick of prediction.topPicks ?? []) {
      if (!pick.key) continue;
      const stamp = `${prediction.matchId}:${pick.key}`;
      if (seen.has(stamp)) continue;
      seen.add(stamp);
      queries.push({ matchId: prediction.matchId, selectionKey: pick.key });
    }
  }

  return queries;
}
