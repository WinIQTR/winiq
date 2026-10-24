import Link from "next/link";

import { MemberSmartDashboard } from "@/components/member-smart-dashboard";
import { requireAdmin } from "@/lib/auth-session";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";
import {
  MEMBERSHIP_PLAN_LABELS,
  MEMBERSHIP_PLAN_MARKET_LIMITS,
  type MembershipPlanName,
} from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

function parsePlan(value: string | string[] | undefined): MembershipPlanName {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === "ANALYSIS" || plan === "PROFESSIONAL" ? plan : "BASIC";
}

export default async function MembershipPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[]; date?: string | string[] }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const plan = parsePlan(query.plan);
  const selectedDate = Array.isArray(query.date) ? query.date[0] : query.date;
  const allPredictions = await loadDashboardPredictionSnapshot(5_000);
  const predictions = allPredictions
    .filter((item) => item.settlementStatus === undefined || item.settlementStatus === "PENDING")
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())
    .slice(0, 200);

  return (
    <>
      <nav className="membership-preview-switch" aria-label="Üyelik görünümü seçin">
        {(["BASIC", "ANALYSIS", "PROFESSIONAL"] as const).map((item) => (
          <Link
            className={item === plan ? "active" : ""}
            href={`/admin/members/preview?plan=${item}`}
            key={item}
          >
            <span>{MEMBERSHIP_PLAN_LABELS[item]}</span>
            <small>
              {MEMBERSHIP_PLAN_MARKET_LIMITS[item]}/{BET_MARKET_COUNT} pazar
            </small>
          </Link>
        ))}
      </nav>
      <MemberSmartDashboard
        name="Örnek Üye"
        plan={plan}
        predictions={predictions}
        preview
        selectedDate={selectedDate}
      />
    </>
  );
}
