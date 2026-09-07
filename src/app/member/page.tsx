import { MemberSmartDashboard } from "@/components/member-smart-dashboard";
import { requireMember } from "@/lib/auth-session";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TURKEY_TIME_ZONE = "Europe/Istanbul";

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TURKEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function MemberPage() {
  const user = await requireMember();
  const today = dateKey(new Date());
  const allPredictions = await loadDashboardPredictionSnapshot(5_000);
  const predictions = allPredictions
    .filter((item) => dateKey(item.kickoffAt) === today)
    .filter((item) => item.settlementStatus === undefined || item.settlementStatus === "PENDING")
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  return <MemberSmartDashboard name={user.name} plan={user.plan} predictions={predictions} />;
}
