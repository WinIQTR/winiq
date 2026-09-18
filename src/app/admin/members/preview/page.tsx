import Link from "next/link";

import { MemberSmartDashboard } from "@/components/member-smart-dashboard";
import { requireAdmin } from "@/lib/auth-session";
import { MEMBERSHIP_PLAN_LABELS, type MembershipPlanName } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";

function parsePlan(value: string | string[] | undefined): MembershipPlanName {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === "ANALYSIS" || plan === "PROFESSIONAL" ? plan : "BASIC";
}

export default async function MembershipPreviewPage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  await requireAdmin();
  const plan = parsePlan((await searchParams).plan);
  const allPredictions = await loadDashboardPredictionSnapshot(5_000);
  const predictions = allPredictions
    .filter((item) => item.settlementStatus === undefined || item.settlementStatus === "PENDING")
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())
    .slice(0, 12);

  return (
    <>
      <nav className="membership-preview-switch" aria-label="Üyelik görünümü seçin">
        {(["BASIC", "ANALYSIS", "PROFESSIONAL"] as const).map((item) => (
          <Link className={item === plan ? "active" : ""} href={`/admin/members/preview?plan=${item}`} key={item}>
            <span>{MEMBERSHIP_PLAN_LABELS[item]}</span><small>{item === "BASIC" ? "6" : item === "ANALYSIS" ? "19" : BET_MARKET_COUNT} pazar</small>
          </Link>
        ))}
      </nav>
      <MemberSmartDashboard name="Örnek Üye" plan={plan} predictions={predictions} preview />
    </>
  );
}
