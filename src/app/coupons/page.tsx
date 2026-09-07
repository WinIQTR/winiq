import { PageShell } from "@/components/page-shell";
import { SmartCouponWorkspace } from "@/components/smart-coupon-workspace";
import { requireAdmin } from "@/lib/auth-session";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import styles from "./smart-coupons-page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SmartCouponsPage() {
  await requireAdmin();
  const data = await loadValueBetDashboardSnapshot();
  const center = buildSmartCouponCenter(data.upcoming, {
    historicalRows: data.settled,
  });
  const serialized = serializeCouponCenter(center);

  return (
    <PageShell>
      <main className={styles.page}>
        <SmartCouponWorkspace
          {...serialized}
          missing={center.missing}
          eligibleCandidates={center.eligibleCandidates}
          advisoryCandidates={center.advisoryCandidates}
          rejectedCandidates={center.rejectedCandidates}
          rejectionBreakdown={center.rejectionBreakdown}
          access="ADMIN"
        />
      </main>
    </PageShell>
  );
}
