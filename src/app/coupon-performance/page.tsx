import { CouponPerformanceWorkspace } from "@/components/coupon-performance-workspace";
import { PageShell } from "@/components/page-shell";
import { loadSmartCouponPerformance } from "@/lib/smart-coupon-performance-data";
import styles from "./coupon-performance-page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CouponPerformancePage() {
  const data = await loadSmartCouponPerformance();
  const rows = data.rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    legs: row.legs.map((leg) => ({ ...leg, kickoffAt: leg.kickoffAt.toISOString() })),
  }));
  return <PageShell><main className={styles.page}><CouponPerformanceWorkspace rows={rows} report={data.report} /></main></PageShell>;
}
