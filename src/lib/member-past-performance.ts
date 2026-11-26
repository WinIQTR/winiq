import type { MemberPerformance } from "@/components/member-smart-dashboard";
import type {
  MemberResultsMatch,
  MemberResultsMatchStats,
  MemberResultsOddsBand,
} from "@/components/member-results-board";
import {
  MEMBER_ODDS_BAND_DEFS,
  mapPublishedOddsToBandKey,
  resolvePublishedSelectionOdds,
} from "@/lib/member-odds-bands";
import {
  loadMarketOddsByPickKey,
  marketOddsPickKey,
} from "@/lib/member-market-odds";
import { prisma } from "@/lib/prisma";

type MatchEnrichment = {
  homeScore: number | null;
  awayScore: number | null;
  favouriteLabel: string | null;
  winnerLabel: string | null;
  homeRating: number | null;
  awayRating: number | null;
  matchStats: MemberResultsMatchStats | null;
};

function winnerFromScore(
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
): string | null {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return homeTeam;
  if (awayScore > homeScore) return awayTeam;
  return "Draw";
}

function favouriteFromOneXTwo(options: {
  homeTeam: string;
  awayTeam: string;
  picks: Array<{ marketKey: string; probability: number | null }>;
}): string | null {
  let best: { key: string; probability: number } | null = null;
  for (const pick of options.picks) {
    const key = pick.marketKey.trim().toLocaleLowerCase("tr-TR");
    if (key !== "ms-1" && key !== "ms-0" && key !== "ms-2") continue;
    if (pick.probability == null || !Number.isFinite(pick.probability)) continue;
    if (!best || pick.probability > best.probability) {
      best = { key, probability: pick.probability };
    }
  }
  if (!best) return null;
  if (best.key === "ms-1") return options.homeTeam;
  if (best.key === "ms-2") return options.awayTeam;
  return "Draw";
}

function pairStats(
  homeTeamId: number,
  awayTeamId: number,
  rows: Array<{
    teamId: number;
    shots: number | null;
    shotsOnTarget: number | null;
    corners: number | null;
    yellowCards: number | null;
    redCards: number | null;
    possession: number | null;
  }>,
): MemberResultsMatchStats | null {
  const home = rows.find((row) => row.teamId === homeTeamId) ?? null;
  const away = rows.find((row) => row.teamId === awayTeamId) ?? null;
  if (!home && !away) return null;
  return {
    shotsHome: home?.shots ?? null,
    shotsAway: away?.shots ?? null,
    shotsOnTargetHome: home?.shotsOnTarget ?? null,
    shotsOnTargetAway: away?.shotsOnTarget ?? null,
    cornersHome: home?.corners ?? null,
    cornersAway: away?.corners ?? null,
    yellowCardsHome: home?.yellowCards ?? null,
    yellowCardsAway: away?.yellowCards ?? null,
    redCardsHome: home?.redCards ?? null,
    redCardsAway: away?.redCards ?? null,
    possessionHome: home?.possession ?? null,
    possessionAway: away?.possession ?? null,
  };
}

export {
  MEMBER_ODDS_BAND_DEFS,
  mapPublishedOddsToBandKey,
  resolvePublishedSelectionOdds,
} from "@/lib/member-odds-bands";

const TZ = "Europe/Istanbul";

export type MemberV2Insights = {
  equitySparkline: string | null;
  clvPct: number | null;
  loggedBeforeKickoffPct: number | null;
  recentResults: Array<"WON" | "LOST" | "VOID">;
  streakLabel: string;
  leagueChips: Array<{ label: string; rate: number; samples: number }>;
  voidsExcludedNote: true;
  homeBaselineHitRate: number;
};

export type MemberPastPerformanceBundle = {
  performance: MemberPerformance;
  oddsBands: MemberResultsOddsBand[];
  /** Settled WON+LOST across strength bands (voids excluded from rate samples). */
  strengthEvaluated: number;
  /** WON+LOST that landed in an odds band. */
  oddsBandEvaluated: number;
  /** Settled rows with no usable market/fair odds (or odds &lt; 1.10). */
  oddsMissing: number;
  matches: MemberResultsMatch[];
  v2: MemberV2Insights;
};

function emptyBand(): MemberPerformance["strong"] {
  return {
    rate: null,
    samples: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    unavailable: 0,
    total: 0,
  };
}

/** Map SmartPickHistory.tier → Güçlü / Orta / Zayıf summary cards. */
export function mapSmartPickTierToBand(
  tier: string,
): "strong" | "medium" | "weak" {
  const normalized = tier.trim().toUpperCase();
  if (
    normalized === "VERY_HIGH" ||
    normalized === "HIGH" ||
    normalized === "STRONG" ||
    normalized === "GÜÇLÜ" ||
    normalized === "GUCLU"
  ) {
    return "strong";
  }
  if (
    normalized === "MEDIUM" ||
    normalized === "ORTA" ||
    normalized === "REVIEW"
  ) {
    return "medium";
  }
  return "weak";
}

function bandFromCounts(wins: number, losses: number, voids: number, total: number) {
  const samples = wins + losses;
  return {
    rate: samples ? (wins / samples) * 100 : null,
    samples,
    wins,
    losses,
    voids,
    unavailable: 0,
    total,
  };
}

/**
 * Past-performance source of truth: settled SmartPickHistory rows in Neon.
 * Dashboard snapshot alone is too thin (upcoming-heavy) and previously drove
 * all-zero Güçlü/Orta/Zayıf cards while the results list still showed a few
 * published rows.
 */
export async function loadMemberPastPerformance(options?: {
  matchLimit?: number;
}): Promise<MemberPastPerformanceBundle> {
  const matchLimit = options?.matchLimit ?? 40;

  const settledRows = await prisma.smartPickHistory.findMany({
    where: { result: { in: ["WON", "LOST", "VOID"] } },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      matchId: true,
      marketKey: true,
      market: true,
      tier: true,
      result: true,
      fairOdds: true,
      marketOdds: true,
      leagueName: true,
      kickoffAt: true,
      publishedAt: true,
    },
  });

  const needsLookup = settledRows
    .filter(
      (row) =>
        !(
          row.marketOdds != null &&
          Number.isFinite(row.marketOdds) &&
          row.marketOdds > 1
        ),
    )
    .map((row) => ({ matchId: row.matchId, marketKey: row.marketKey }));
  const marketOddsLookup = await loadMarketOddsByPickKey(needsLookup);

  const buckets = {
    strong: { wins: 0, losses: 0, voids: 0, total: 0 },
    medium: { wins: 0, losses: 0, voids: 0, total: 0 },
    weak: { wins: 0, losses: 0, voids: 0, total: 0 },
  };
  const oddsBucketMap = new Map<
    string,
    { wins: number; losses: number; voids: number; total: number }
  >();
  for (const def of MEMBER_ODDS_BAND_DEFS) {
    oddsBucketMap.set(def.key, { wins: 0, losses: 0, voids: 0, total: 0 });
  }
  let oddsMissing = 0;
  let bankroll = 1000;
  const equityPoints: number[] = [bankroll];
  const clvSamples: number[] = [];
  let loggedBefore = 0;
  let loggedTotal = 0;
  const leagueMap = new Map<string, { wins: number; losses: number }>();
  const oddsByRowId = new Map<number, { odds: number; bandKey: string | null }>();

  for (const row of settledRows) {
    const band = mapSmartPickTierToBand(row.tier);
    buckets[band].total += 1;
    if (row.result === "WON") buckets[band].wins += 1;
    else if (row.result === "LOST") buckets[band].losses += 1;
    else if (row.result === "VOID") buckets[band].voids += 1;

    loggedTotal += 1;
    if (row.publishedAt.getTime() < row.kickoffAt.getTime()) loggedBefore += 1;

    const lookedUp =
      marketOddsLookup.get(marketOddsPickKey(row.matchId, row.marketKey)) ??
      null;
    const odds = resolvePublishedSelectionOdds({
      fairOdds: row.fairOdds,
      marketOdds:
        row.marketOdds != null &&
        Number.isFinite(row.marketOdds) &&
        row.marketOdds > 1
          ? row.marketOdds
          : lookedUp,
    });
    const oddsKey =
      odds != null && odds >= 1.1 ? mapPublishedOddsToBandKey(odds) : null;
    oddsByRowId.set(row.id, { odds: odds ?? 0, bandKey: oddsKey });

    if (row.result === "WON" || row.result === "LOST") {
      const league = leagueMap.get(row.leagueName) ?? { wins: 0, losses: 0 };
      if (row.result === "WON") league.wins += 1;
      else league.losses += 1;
      leagueMap.set(row.leagueName, league);

      if (odds != null && odds > 1) {
        const stake = 1;
        bankroll += row.result === "WON" ? stake * (odds - 1) : -stake;
        equityPoints.push(bankroll);
        if (row.fairOdds != null && row.fairOdds > 1) {
          clvSamples.push(odds / row.fairOdds - 1);
        }
      }
    }

    if (odds === null || odds < 1.1) {
      if (row.result === "WON" || row.result === "LOST") oddsMissing += 1;
      continue;
    }
    if (!oddsKey) {
      if (row.result === "WON" || row.result === "LOST") oddsMissing += 1;
      continue;
    }
    const oddsBucket = oddsBucketMap.get(oddsKey);
    if (!oddsBucket) continue;
    oddsBucket.total += 1;
    if (row.result === "WON") oddsBucket.wins += 1;
    else if (row.result === "LOST") oddsBucket.losses += 1;
    else if (row.result === "VOID") oddsBucket.voids += 1;
  }

  const performance: MemberPerformance = {
    strong: bandFromCounts(
      buckets.strong.wins,
      buckets.strong.losses,
      buckets.strong.voids,
      buckets.strong.total,
    ),
    medium: bandFromCounts(
      buckets.medium.wins,
      buckets.medium.losses,
      buckets.medium.voids,
      buckets.medium.total,
    ),
    weak: bandFromCounts(
      buckets.weak.wins,
      buckets.weak.losses,
      buckets.weak.voids,
      buckets.weak.total,
    ),
  };

  if (
    performance.strong.samples +
      performance.medium.samples +
      performance.weak.samples ===
    0
  ) {
    performance.strong = emptyBand();
    performance.medium = emptyBand();
    performance.weak = emptyBand();
  }

  const oddsBands: MemberResultsOddsBand[] = MEMBER_ODDS_BAND_DEFS.map(
    (def) => {
      const bucket = oddsBucketMap.get(def.key) ?? {
        wins: 0,
        losses: 0,
        voids: 0,
        total: 0,
      };
      const counted = bandFromCounts(
        bucket.wins,
        bucket.losses,
        bucket.voids,
        bucket.total,
      );
      return {
        key: def.key,
        label: def.label,
        tone: def.tone,
        rate: counted.rate,
        wins: counted.wins,
        losses: counted.losses,
        samples: counted.samples,
      };
    },
  );
  const strengthEvaluated =
    performance.strong.samples +
    performance.medium.samples +
    performance.weak.samples;
  const oddsBandEvaluated = oddsBands.reduce(
    (total, band) => total + band.samples,
    0,
  );

  const recent = await prisma.smartPickHistory.findMany({
    where: { result: { in: ["WON", "LOST", "VOID"] } },
    orderBy: [{ kickoffAt: "desc" }, { settledAt: "desc" }, { rank: "asc" }],
    take: 400,
    select: {
      id: true,
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      leagueName: true,
      kickoffAt: true,
      result: true,
      market: true,
      marketKey: true,
      selection: true,
      category: true,
      tier: true,
      probability: true,
      actualHomeScore: true,
      actualAwayScore: true,
      match: {
        select: {
          homeScore: true,
          awayScore: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: { select: { logoUrl: true } },
          awayTeam: { select: { logoUrl: true } },
          teamStatistics: {
            select: {
              teamId: true,
              shots: true,
              shotsOnTarget: true,
              corners: true,
              yellowCards: true,
              redCards: true,
              possession: true,
            },
          },
          squadStrengthScores: {
            select: {
              teamId: true,
              overallSquadScore: true,
              calculatedAt: true,
            },
            orderBy: { calculatedAt: "desc" },
          },
        },
      },
    },
  });

  const oneXTwoByMatch = new Map<
    number,
    Array<{ marketKey: string; probability: number | null }>
  >();
  for (const row of recent) {
    const list = oneXTwoByMatch.get(row.matchId) ?? [];
    list.push({ marketKey: row.marketKey, probability: row.probability });
    oneXTwoByMatch.set(row.matchId, list);
  }

  const enrichmentByMatch = new Map<number, MatchEnrichment>();
  for (const row of recent) {
    if (enrichmentByMatch.has(row.matchId)) continue;
    const match = row.match;
    const homeScore = match?.homeScore ?? row.actualHomeScore ?? null;
    const awayScore = match?.awayScore ?? row.actualAwayScore ?? null;
    const homeTeamId = match?.homeTeamId ?? null;
    const awayTeamId = match?.awayTeamId ?? null;

    let homeRating: number | null = null;
    let awayRating: number | null = null;
    if (homeTeamId != null && awayTeamId != null && match?.squadStrengthScores?.length) {
      const seen = new Set<number>();
      for (const score of match.squadStrengthScores) {
        if (seen.has(score.teamId)) continue;
        seen.add(score.teamId);
        if (score.teamId === homeTeamId) homeRating = score.overallSquadScore;
        if (score.teamId === awayTeamId) awayRating = score.overallSquadScore;
      }
    }

    enrichmentByMatch.set(row.matchId, {
      homeScore,
      awayScore,
      favouriteLabel: favouriteFromOneXTwo({
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        picks: oneXTwoByMatch.get(row.matchId) ?? [],
      }),
      winnerLabel: winnerFromScore(row.homeTeam, row.awayTeam, homeScore, awayScore),
      homeRating,
      awayRating,
      matchStats:
        homeTeamId != null && awayTeamId != null
          ? pairStats(homeTeamId, awayTeamId, match?.teamStatistics ?? [])
          : null,
    });
  }

  const matches: MemberResultsMatch[] = [];
  for (const row of recent) {
    const status =
      row.result === "WON" || row.result === "LOST" || row.result === "VOID"
        ? row.result
        : ("OTHER" as const);
    const day = new Intl.DateTimeFormat("tr-TR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(row.kickoffAt);
    const dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(row.kickoffAt);
    const marketLabel = (row.market || row.category || "").trim() || "—";
    const selectionLabel = (row.selection || "").trim() || "—";
    const pickLabel = [marketLabel, selectionLabel]
      .filter((part) => part && part !== "—")
      .join(" · ");
    const oddsMeta = oddsByRowId.get(row.id);
    const enrichment = enrichmentByMatch.get(row.matchId);
    matches.push({
      matchId: row.matchId,
      rowKey: `${row.matchId}-${row.id}`,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeTeamLogo: row.match?.homeTeam?.logoUrl ?? null,
      awayTeamLogo: row.match?.awayTeam?.logoUrl ?? null,
      leagueName: row.leagueName,
      dateKey,
      dateLabel: day,
      pickLabel: pickLabel || "—",
      marketLabel,
      selectionLabel,
      tierLabel: mapSmartPickTierToBand(row.tier),
      oddsBandKey: oddsMeta?.bandKey ?? null,
      status,
      statusLabel:
        status === "WON"
          ? "Won"
          : status === "LOST"
            ? "Lost"
            : status === "VOID"
              ? "Void (not a loss)"
              : "Not settled yet",
      href: `/member/matches/${row.matchId}`,
      homeScore: enrichment?.homeScore ?? null,
      awayScore: enrichment?.awayScore ?? null,
      favouriteLabel: enrichment?.favouriteLabel ?? null,
      winnerLabel: enrichment?.winnerLabel ?? null,
      homeRating: enrichment?.homeRating ?? null,
      awayRating: enrichment?.awayRating ?? null,
      matchStats: enrichment?.matchStats ?? null,
    });
    if (matches.length >= matchLimit) break;
  }

  const recentResults = recent
    .map((row) => row.result)
    .filter(
      (result): result is "WON" | "LOST" | "VOID" =>
        result === "WON" || result === "LOST" || result === "VOID",
    )
    .slice(0, 40);

  let streak = 0;
  let streakKind: "WON" | "LOST" | null = null;
  for (const item of recentResults) {
    if (item === "VOID") continue;
    if (!streakKind) {
      streakKind = item;
      streak = 1;
      continue;
    }
    if (item === streakKind) streak += 1;
    else break;
  }

  const equitySparkline =
    equityPoints.length > 1
      ? (() => {
          const min = Math.min(...equityPoints);
          const max = Math.max(...equityPoints);
          const span = Math.max(1e-6, max - min);
          return equityPoints
            .map((value, index) => {
              const x = (index / (equityPoints.length - 1)) * 100;
              const y = 26 - ((value - min) / span) * 24;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
        })()
      : null;

  const leagueChips = [...leagueMap.entries()]
    .map(([label, counts]) => {
      const samples = counts.wins + counts.losses;
      return {
        label,
        samples,
        rate: samples ? (counts.wins / samples) * 100 : 0,
      };
    })
    .filter((item) => item.samples >= 20)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);

  const clvPct =
    clvSamples.length > 0
      ? (clvSamples.reduce((sum, value) => sum + value, 0) / clvSamples.length) *
        100
      : null;

  return {
    performance,
    oddsBands,
    strengthEvaluated,
    oddsBandEvaluated,
    oddsMissing,
    matches,
    v2: {
      equitySparkline,
      clvPct,
      loggedBeforeKickoffPct: loggedTotal
        ? (loggedBefore / loggedTotal) * 100
        : null,
      recentResults,
      streakLabel:
        streakKind && streak > 0
          ? `${streak} ${streakKind === "WON" ? "win" : "loss"} streak`
          : "No streak yet",
      leagueChips,
      voidsExcludedNote: true,
      homeBaselineHitRate: 45,
    },
  };
}
