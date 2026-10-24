import { redirect } from "next/navigation";

import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import {
  MemberValueOpportunities,
  type MemberValueOpportunity,
} from "@/components/member-value-opportunities";
import { readAppLocale } from "@/lib/app-locale-server";
import { requireMember } from "@/lib/auth-session";
import { hasMembershipPermission } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel } from "@/lib/prediction-dashboard-shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "Europe/Istanbul";

function formatKickoffLabel(date: Date, locale: "tr" | "en" = "en") {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (dayKey === todayKey) return locale === "tr" ? `Bugün ${time}` : `Today ${time}`;

  const day = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day} ${time}`;
}

export default async function MemberValuePage() {
  const user = await requireMember();
  const locale = await readAppLocale();
  if (
    !hasMembershipPermission(user.plan, "VALUE_BETS") &&
    !hasMembershipPermission(user.plan, "SMART_PICKS")
  ) {
    redirect("/member/plans");
  }

  const now = new Date();
  const rows = (await loadDashboardPredictionSnapshot(5_000))
    .filter(
      (item) =>
        item.kickoffAt >= now &&
        (item.settlementStatus === undefined || item.settlementStatus === "PENDING") &&
        item.confidenceScore >= 65,
    )
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 30);

  const opportunities: MemberValueOpportunity[] = rows.map((item) => {
    const top = item.topPicks[0];
    const modelOdds =
      top?.fairOdds && top.fairOdds > 0
        ? top.fairOdds
        : item.predictedProbability > 0
          ? 100 / item.predictedProbability
          : null;

    return {
      matchId: item.matchId,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      homeTeamLogo: item.homeTeamLogo,
      awayTeamLogo: item.awayTeamLogo,
      leagueName: item.leagueName,
      kickoffIso: item.kickoffAt.toISOString(),
      kickoffLabel: formatKickoffLabel(item.kickoffAt, locale),
      market: top?.market ?? "Match result",
      selection: top?.selection ?? item.predictedOutcome,
      marketLabel: getPredictionLabel(item),
      modelOdds,
      confidenceScore: item.confidenceScore,
      href: `/member/matches/${item.matchId}`,
      homeRecentResults: item.homeRecentResults,
      awayRecentResults: item.awayRecentResults,
      homeVenueResults: item.homeVenueResults,
      awayVenueResults: item.awayVenueResults,
    };
  });

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="value" memberName={user.name} />
      <div className={member.page}>
        <MemberValueOpportunities opportunities={opportunities} />
      </div>
    </main>
  );
}
