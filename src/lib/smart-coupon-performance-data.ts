import { prisma } from "@/lib/prisma";
import {
  buildCouponPerformanceReport,
  deduplicateCouponPerformanceRows,
  type CouponPerformanceRow,
  type CouponSettlement,
} from "@/lib/smart-coupon-performance";

function settlement(value: string): CouponSettlement {
  return ["PENDING", "WON", "LOST", "VOID"].includes(value)
    ? value as CouponSettlement
    : "VOID";
}

export async function loadSmartCouponPerformance(limit = 500) {
  const records = await prisma.smartCouponHistory.findMany({
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { legs: { orderBy: { kickoffAt: "asc" } } },
  });
  const rows: CouponPerformanceRow[] = records.map((coupon) => ({
    id: coupon.id,
    window: coupon.window,
    band: coupon.band,
    title: coupon.title,
    totalOdds: coupon.totalOdds,
    combinedModelProbability: coupon.combinedModelProbability,
    result: settlement(coupon.result),
    profitUnits: coupon.profitUnits,
    publishedAt: coupon.publishedAt,
    settledAt: coupon.settledAt,
    legs: coupon.legs.map((leg) => ({
      id: leg.id,
      matchId: leg.matchId,
      kickoffAt: leg.kickoffAt,
      leagueName: leg.leagueName,
      homeTeam: leg.homeTeam,
      awayTeam: leg.awayTeam,
      market: leg.market,
      marketKey: leg.marketKey,
      selection: leg.selection,
      odds: leg.odds,
      modelProbability: leg.modelProbability,
      result: settlement(leg.result),
      actualHomeScore: leg.actualHomeScore,
      actualAwayScore: leg.actualAwayScore,
    })),
  }));
  const uniqueRows = deduplicateCouponPerformanceRows(rows);
  return { rows: uniqueRows, report: buildCouponPerformanceReport(uniqueRows) };
}
