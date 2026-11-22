import type { MemberPerformance } from "@/components/member-smart-dashboard";
import type {
  MemberResultsMatch,
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
      selection: true,
      category: true,
      tier: true,
      match: {
        select: {
          homeTeam: { select: { logoUrl: true } },
          awayTeam: { select: { logoUrl: true } },
        },
      },
    },
  });

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
    const pickLabel = [row.market || row.category, row.selection].filter(Boolean).join(" · ");
    const oddsMeta = oddsByRowId.get(row.id);
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
