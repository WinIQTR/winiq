import { MemberSmartDashboard, type MemberPerformance } from "@/components/member-smart-dashboard";
import { requireMember } from "@/lib/auth-session";
import { buildMarketPerformanceArchive } from "@/lib/market-performance-archive";
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

function performanceOf(predictions: Awaited<ReturnType<typeof loadDashboardPredictionSnapshot>>): MemberPerformance {
  const rows = buildMarketPerformanceArchive(predictions, { from: new Date(0), to: new Date() });
  const band = (tier: "STRONG" | "MEDIUM" | "WEAK") => {
    const tierRows = rows.filter(item => item.tier === tier);
    const wins = tierRows.filter(item => item.result === "WON").length;
    const losses = tierRows.filter(item => item.result === "LOST").length;
    const voids = tierRows.filter(item => item.result === "VOID").length;
    const unavailable = tierRows.filter(item => item.result === "DATA_MISSING").length;
    const evaluated = wins + losses;
    return { rate: evaluated ? wins / evaluated * 100 : null, samples: evaluated, wins, losses, voids, unavailable, total: tierRows.length };
  };
  return { strong: band("STRONG"), medium: band("MEDIUM"), weak: band("WEAK") };
}

export default async function MemberPage() {
  const user = await requireMember();
  const now = new Date();
  const today = dateKey(now);
  const allPredictions = await loadDashboardPredictionSnapshot(5_000);
  const upcoming = allPredictions
    .filter((item) => item.kickoffAt >= now)
    .filter((item) => item.settlementStatus === undefined || item.settlementStatus === "PENDING")
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
  const todayPredictions = upcoming.filter((item) => dateKey(item.kickoffAt) === today);
  const predictions = (todayPredictions.length ? todayPredictions : upcoming).slice(0, 48);

  return <MemberSmartDashboard name={user.name} plan={user.plan} predictions={predictions} performance={performanceOf(allPredictions)} />;
}
