import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { SmartCouponWorkspace } from "@/components/smart-coupon-workspace";
import { requireMember } from "@/lib/auth-session";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import couponStyles from "@/app/coupons/smart-coupons-page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberCouponsPage() {
  const user = await requireMember();
  const data = await loadValueBetDashboardSnapshot();
  const center = buildSmartCouponCenter(data.upcoming, {
    historicalRows: data.settled,
  });
  const serialized = serializeCouponCenter(center);

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="coupons" />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p data-no-translate>WINIQ · KUPONLAR</p>
            <h1>Kupon merkezi</h1>
            <span>Paketinize açık günlük ve haftalık kupon önerileri.</span>
          </div>
        </section>
        <div className={couponStyles.page}>
          <SmartCouponWorkspace
            {...serialized}
            missing={center.missing}
            eligibleCandidates={center.eligibleCandidates}
            advisoryCandidates={center.advisoryCandidates}
            rejectedCandidates={center.rejectedCandidates}
            rejectionBreakdown={center.rejectionBreakdown}
            access={user.plan}
          />
        </div>
      </div>
    </main>
  );
}
