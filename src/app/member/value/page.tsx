import { redirect } from "next/navigation";

import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { MemberShortlistTabs } from "@/components/member-shortlist-tabs";
import {
  MemberValueOpportunities,
  type MemberValueOpportunity,
} from "@/components/member-value-opportunities";
import { readAppLocale } from "@/lib/app-locale-server";
import { requireMember } from "@/lib/auth-session";
import { loadMarketLineMoves } from "@/lib/market-line-move";
import {
  marketLineMoveKey,
  marketLineMovesToRecord,
} from "@/lib/market-line-move-shared";
import { hasMembershipPermission } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel } from "@/lib/prediction-dashboard-shared";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";

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
  const canValue = hasMembershipPermission(user.plan, "VALUE_BETS");
  const canSmart = hasMembershipPermission(user.plan, "SMART_PICKS");
  if (!canValue && !canSmart) {
    redirect("/member/plans");
  }

  const now = new Date();
  let opportunities: MemberValueOpportunity[] = [];
  let mode: "value" | "confidence" = "confidence";

  if (canValue) {
    mode = "value";
    const snapshot = await loadValueBetDashboardSnapshot();
    const rows = snapshot.upcoming
      .filter(
        (item) =>
          item.kickoffAt >= now &&
          item.result === "PENDING" &&
          item.expectedValue > 0 &&
          item.marketEdge > 0,
      )
      .sort((a, b) => b.expectedValue - a.expectedValue || b.valueScore - a.valueScore)
      .slice(0, 40);

    const lineMoves = marketLineMovesToRecord(
      await loadMarketLineMoves(
        rows.map((item) => ({
          matchId: item.matchId,
          selectionKey: `${item.marketKey}:${item.selection}`,
        })),
      ),
    );

    opportunities = rows.map((item) => ({
      matchId: item.matchId,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
      homeTeamLogo: null,
      awayTeamLogo: null,
      leagueName: item.leagueName,
      kickoffIso: item.kickoffAt.toISOString(),
      kickoffLabel: formatKickoffLabel(item.kickoffAt, locale),
      market: item.market,
      selection: item.selection,
      marketLabel: `${item.market} · ${item.selection}`,
      modelOdds: item.fairOdds,
      bestOdds: item.bestOdds,
      fairOdds: item.fairOdds,
      expectedValue: item.expectedValue,
      marketEdge: item.marketEdge,
      bookmakerName: item.bookmakerName,
      confidenceScore: Math.max(0, Math.min(100, item.valueScore)),
      href: `/member/matches/${item.matchId}`,
      lineMove:
        lineMoves[marketLineMoveKey(item.matchId, `${item.marketKey}:${item.selection}`)] ?? null,
    }));
  } else {
    const rows = (await loadDashboardPredictionSnapshot(5_000))
      .filter(
        (item) =>
          item.kickoffAt >= now &&
          (item.settlementStatus === undefined || item.settlementStatus === "PENDING") &&
          item.confidenceScore >= 65,
      )
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 30);

    const lineMoves = marketLineMovesToRecord(
      await loadMarketLineMoves(
        rows
          .map((item) => {
            const key = item.topPicks[0]?.key;
            return key ? { matchId: item.matchId, selectionKey: key } : null;
          })
          .filter((item): item is { matchId: number; selectionKey: string } => Boolean(item)),
      ),
    );

    opportunities = rows.map((item) => {
      const top = item.topPicks[0];
      const modelOdds =
        top?.fairOdds && top.fairOdds > 0
          ? top.fairOdds
          : item.predictedProbability > 0
            ? 100 / item.predictedProbability
            : null;
      const lineMove = top?.key
        ? lineMoves[marketLineMoveKey(item.matchId, top.key)] ?? null
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
        lineMove,
        homeRecentResults: item.homeRecentResults,
        awayRecentResults: item.awayRecentResults,
        homeVenueResults: item.homeVenueResults,
        awayVenueResults: item.awayVenueResults,
      };
    });
  }

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="value" memberName={user.name} />
      <div className={member.page}>
        {user.plan === "PROFESSIONAL" ? <MemberShortlistTabs active="value" /> : null}
        <MemberValueOpportunities opportunities={opportunities} mode={mode} />
      </div>
    </main>
  );
}
