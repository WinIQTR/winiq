import { MarketPerformanceWorkspace } from "@/components/market-performance-workspace";
import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_LABEL } from "@/config/season";
import {
  buildMarketPerformanceArchive,
  MARKET_PERFORMANCE_TYPES,
} from "@/lib/market-performance-archive";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import styles from "./match-result-performance.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 15 Ağustos 2026 00:00, Europe/Istanbul (UTC+3)
const PERFORMANCE_START = new Date(Date.UTC(2026, 7, 14, 21, 0, 0));

export default async function MatchResultPerformancePage() {
  const reportGeneratedAt = new Date();
  const archivedPredictions = await loadDashboardPredictionSnapshot(20_000);
  const rows = buildMarketPerformanceArchive(archivedPredictions, {
    from: PERFORMANCE_START,
    to: reportGeneratedAt,
  });

  return (
    <PageShell>
      <main className={styles.page}>
        <MarketPerformanceWorkspace
          marketTypes={MARKET_PERFORMANCE_TYPES}
          rows={rows.map((row) => ({
            ...row,
            kickoffAt: row.kickoffAt.toISOString(),
          }))}
          seasonLabel={ACTIVE_SEASON_LABEL}
        />
      </main>
    </PageShell>
  );
}
