import { MemberPortalHeader, type MemberPerformance } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import {
  MemberResultsBoard,
  type MemberResultsMatch,
} from "@/components/member-results-board";
import { requireMember } from "@/lib/auth-session";
import { buildMarketPerformanceArchive } from "@/lib/market-performance-archive";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "Europe/Istanbul";

function performanceOf(
  predictions: Awaited<ReturnType<typeof loadDashboardPredictionSnapshot>>,
): MemberPerformance {
  const rows = buildMarketPerformanceArchive(predictions, { from: new Date(0), to: new Date() });
  const band = (tier: "STRONG" | "MEDIUM" | "WEAK") => {
    const tierRows = rows.filter((item) => item.tier === tier);
    const wins = tierRows.filter((item) => item.result === "WON").length;
    const losses = tierRows.filter((item) => item.result === "LOST").length;
    const voids = tierRows.filter((item) => item.result === "VOID").length;
    const unavailable = tierRows.filter((item) => item.result === "DATA_MISSING").length;
    const evaluated = wins + losses;
    return {
      rate: evaluated ? (wins / evaluated) * 100 : null,
      samples: evaluated,
      wins,
      losses,
      voids,
      unavailable,
      total: tierRows.length,
    };
  };
  return { strong: band("STRONG"), medium: band("MEDIUM"), weak: band("WEAK") };
}

function dateKeyOf(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateLabelOf(date: Date, status: string) {
  const day = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${day} · ${status.toLowerCase()}`;
}

function statusOf(
  settlementStatus: string | undefined,
): MemberResultsMatch["status"] {
  if (settlementStatus === "WON") return "WON";
  if (settlementStatus === "LOST") return "LOST";
  if (settlementStatus === "VOID") return "VOID";
  if (settlementStatus === "PENDING" || !settlementStatus) return "PENDING";
  return "OTHER";
}

function statusLabelOf(status: MemberResultsMatch["status"]) {
  switch (status) {
    case "WON":
      return "Won";
    case "LOST":
      return "Lost";
    case "VOID":
      return "Void";
    case "PENDING":
      return "Not settled yet";
    default:
      return "Not settled yet";
  }
}

export default async function MemberResultsPage() {
  const user = await requireMember();
  const all = await loadDashboardPredictionSnapshot(5_000);
  const performance = performanceOf(all);
  const settled = all
    .filter((item) => item.settlementStatus && item.settlementStatus !== "PENDING")
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime())
    .slice(0, 40);

  const matches: MemberResultsMatch[] = settled.map((item) => {
    const status = statusOf(item.settlementStatus);
    return {
      matchId: item.matchId,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      homeTeamLogo: item.homeTeamLogo,
      awayTeamLogo: item.awayTeamLogo,
      leagueName: item.leagueName,
      dateKey: dateKeyOf(item.kickoffAt),
      dateLabel: dateLabelOf(item.kickoffAt, item.settlementStatus ?? "pending"),
      status,
      statusLabel: statusLabelOf(status),
      href: `/member/matches/${item.matchId}`,
    };
  });

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="results" memberName={user.name} />
      <div className={member.page}>
        <MemberResultsBoard
          strong={{
            rate: performance.strong.rate,
            wins: performance.strong.wins,
            losses: performance.strong.losses,
            samples: performance.strong.samples,
          }}
          medium={{
            rate: performance.medium.rate,
            wins: performance.medium.wins,
            losses: performance.medium.losses,
            samples: performance.medium.samples,
          }}
          weak={{
            rate: performance.weak.rate,
            wins: performance.weak.wins,
            losses: performance.weak.losses,
            samples: performance.weak.samples,
          }}
          matches={matches}
          todayHref="/member"
        />
      </div>
    </main>
  );
}
