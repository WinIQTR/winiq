import Link from "next/link";
import { CouponPerformanceWorkspace } from "@/components/coupon-performance-workspace";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireMember } from "@/lib/auth-session";
import { loadSmartCouponPerformance } from "@/lib/smart-coupon-performance-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberCouponPerformancePage() {
  await requireMember();
  const data = await loadSmartCouponPerformance();
  const rows = data.rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt.toISOString(),
    settledAt: row.settledAt?.toISOString() ?? null,
    legs: row.legs.map((leg) => ({ ...leg, kickoffAt: leg.kickoffAt.toISOString() })),
  }));
  return <main className="member-shell">
    <nav className="member-topbar"><Link href="/member">Üye paneli</Link><Link href="/member/coupons">Akıllı kuponlar</Link><Link href="/member/messages">Mesajlar</Link><LanguageSwitcher /></nav>
    <CouponPerformanceWorkspace rows={rows} report={data.report} />
  </main>;
}
