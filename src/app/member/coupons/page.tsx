import Link from "next/link";
import { SmartCouponWorkspace } from "@/components/smart-coupon-workspace";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireMember } from "@/lib/auth-session";
import { MEMBERSHIP_PLAN_LABELS } from "@/lib/membership-access";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";

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
    <main className="member-shell">
      <header className="member-header">
        <div>
          <p className="member-eyebrow">{MEMBERSHIP_PLAN_LABELS[user.plan]} ÜYELİK</p>
          <h1>Akıllı Kuponlar</h1>
          <p>Paketinize açık günlük ve haftalık kuponları inceleyin.</p>
        </div>
        <div className="member-actions">
          <LanguageSwitcher />
          <Link className="member-back-link" href="/member">Tahminlere dön</Link>
          <Link className="member-plan-link" href="/member/messages">Mesajlar</Link>
          <Link className="member-plan-link" href="/member/plans">Paketler</Link>
        </div>
      </header>

      <SmartCouponWorkspace
        {...serialized}
        missing={center.missing}
        eligibleCandidates={center.eligibleCandidates}
        advisoryCandidates={center.advisoryCandidates}
        rejectedCandidates={center.rejectedCandidates}
        rejectionBreakdown={center.rejectionBreakdown}
        access={user.plan}
      />
    </main>
  );
}
