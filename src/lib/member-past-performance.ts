import type { MemberPerformance } from "@/components/member-smart-dashboard";
import type { MemberResultsMatch } from "@/components/member-results-board";
import { prisma } from "@/lib/prisma";

const TZ = "Europe/Istanbul";

export type MemberPastPerformanceBundle = {
  performance: MemberPerformance;
  matches: MemberResultsMatch[];
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

  const grouped = await prisma.smartPickHistory.groupBy({
    by: ["tier", "result"],
    _count: { _all: true },
    where: {
      result: { in: ["WON", "LOST", "VOID"] },
    },
  });

  const buckets = {
    strong: { wins: 0, losses: 0, voids: 0, total: 0 },
    medium: { wins: 0, losses: 0, voids: 0, total: 0 },
    weak: { wins: 0, losses: 0, voids: 0, total: 0 },
  };

  for (const row of grouped) {
    const band = mapSmartPickTierToBand(row.tier);
    const count = row._count._all;
    buckets[band].total += count;
    if (row.result === "WON") buckets[band].wins += count;
    else if (row.result === "LOST") buckets[band].losses += count;
    else if (row.result === "VOID") buckets[band].voids += count;
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

  const recent = await prisma.smartPickHistory.findMany({
    where: { result: { in: ["WON", "LOST", "VOID"] } },
    orderBy: [{ kickoffAt: "desc" }, { settledAt: "desc" }],
    take: 400,
    select: {
      matchId: true,
      homeTeam: true,
      awayTeam: true,
      leagueName: true,
      kickoffAt: true,
      result: true,
      match: {
        select: {
          homeTeam: { select: { logoUrl: true } },
          awayTeam: { select: { logoUrl: true } },
        },
      },
    },
  });

  const seen = new Set<number>();
  const matches: MemberResultsMatch[] = [];
  for (const row of recent) {
    if (seen.has(row.matchId)) continue;
    seen.add(row.matchId);
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
    matches.push({
      matchId: row.matchId,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeTeamLogo: row.match?.homeTeam?.logoUrl ?? null,
      awayTeamLogo: row.match?.awayTeam?.logoUrl ?? null,
      leagueName: row.leagueName,
      dateKey,
      dateLabel: `${day} · ${status.toLowerCase()}`,
      status,
      statusLabel:
        status === "WON"
          ? "Won"
          : status === "LOST"
            ? "Lost"
            : status === "VOID"
              ? "Void"
              : "Not settled yet",
      href: `/member/matches/${row.matchId}`,
    });
    if (matches.length >= matchLimit) break;
  }

  return { performance, matches };
}
