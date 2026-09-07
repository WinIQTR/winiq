export type CouponSettlement = "PENDING" | "WON" | "LOST" | "VOID";

export type CouponPerformanceRow = {
  id: number;
  window: string;
  band: string;
  title: string;
  totalOdds: number;
  combinedModelProbability: number;
  result: CouponSettlement;
  profitUnits: number | null;
  publishedAt: Date;
  settledAt: Date | null;
  legs: Array<{
    id: number;
    matchId: number;
    kickoffAt: Date;
    leagueName: string;
    homeTeam: string;
    awayTeam: string;
    market: string;
    marketKey: string;
    selection: string;
    odds: number;
    modelProbability: number;
    result: CouponSettlement;
    actualHomeScore: number | null;
    actualAwayScore: number | null;
  }>;
};

export function couponPerformanceSignature(row: CouponPerformanceRow): string {
  return row.legs
    .map((leg) => `${leg.matchId}:${leg.marketKey}:${leg.selection.trim().toLocaleLowerCase("tr-TR")}`)
    .sort()
    .join("|");
}

export function deduplicateCouponPerformanceRows(
  rows: readonly CouponPerformanceRow[],
): CouponPerformanceRow[] {
  const preferred = [...rows].sort((first, second) => {
    const windowPriority = (first.window === "DAILY" ? 0 : 1) -
      (second.window === "DAILY" ? 0 : 1);
    return windowPriority || first.publishedAt.getTime() - second.publishedAt.getTime();
  });
  const signatures = new Set<string>();
  const result: CouponPerformanceRow[] = [];
  for (const row of preferred) {
    const signature = couponPerformanceSignature(row);
    if (signature && signatures.has(signature)) continue;
    if (signature) signatures.add(signature);
    result.push(row);
  }
  return result.sort((first, second) =>
    second.publishedAt.getTime() - first.publishedAt.getTime());
}

export type CouponPerformanceSummary = {
  total: number;
  pending: number;
  settled: number;
  won: number;
  lost: number;
  voided: number;
  winRate: number | null;
  profitUnits: number;
  roi: number | null;
};

export type CouponPerformanceReport = {
  overall: CouponPerformanceSummary;
  byBand: Array<{ key: string; summary: CouponPerformanceSummary }>;
  byWindow: Array<{ key: string; summary: CouponPerformanceSummary }>;
};

export function resolveCouponSettlement(
  legs: ReadonlyArray<{ result: CouponSettlement; odds: number }>,
): {
  result: CouponSettlement;
  profitUnits: number | null;
  wonLegs: number;
  lostLegs: number;
  voidLegs: number;
  pendingLegs: number;
} {
  const wonLegs = legs.filter((leg) => leg.result === "WON").length;
  const lostLegs = legs.filter((leg) => leg.result === "LOST").length;
  const voidLegs = legs.filter((leg) => leg.result === "VOID").length;
  const pendingLegs = legs.filter((leg) => leg.result === "PENDING").length;
  const result: CouponSettlement = pendingLegs > 0
    ? "PENDING"
    : lostLegs > 0
      ? "LOST"
      : wonLegs > 0
        ? "WON"
        : "VOID";
  const effectiveOdds = legs.reduce(
    (total, leg) => total * (leg.result === "WON" ? leg.odds : 1),
    1,
  );
  return {
    result,
    profitUnits: result === "WON" ? round(effectiveOdds - 1, 2) : result === "LOST" ? -1 : result === "VOID" ? 0 : null,
    wonLegs,
    lostLegs,
    voidLegs,
    pendingLegs,
  };
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function summarize(rows: readonly CouponPerformanceRow[]): CouponPerformanceSummary {
  const won = rows.filter((row) => row.result === "WON").length;
  const lost = rows.filter((row) => row.result === "LOST").length;
  const voided = rows.filter((row) => row.result === "VOID").length;
  const pending = rows.filter((row) => row.result === "PENDING").length;
  const settled = won + lost;
  const profitUnits = rows.reduce((total, row) => total + (row.profitUnits ?? 0), 0);
  return {
    total: rows.length,
    pending,
    settled,
    won,
    lost,
    voided,
    winRate: settled > 0 ? round(won / settled * 100) : null,
    profitUnits: round(profitUnits, 2),
    roi: settled > 0 ? round(profitUnits / settled * 100) : null,
  };
}

function grouped(
  rows: readonly CouponPerformanceRow[],
  keyOf: (row: CouponPerformanceRow) => string,
): Array<{ key: string; summary: CouponPerformanceSummary }> {
  const groups = new Map<string, CouponPerformanceRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, values]) => ({ key, summary: summarize(values) }));
}

export function buildCouponPerformanceReport(
  rows: readonly CouponPerformanceRow[],
): CouponPerformanceReport {
  return {
    overall: summarize(rows),
    byBand: grouped(rows, (row) => row.band),
    byWindow: grouped(rows, (row) => row.window),
  };
}
