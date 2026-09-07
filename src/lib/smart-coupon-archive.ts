import { prisma } from "@/lib/prisma";
import {
  couponSelectionSignature,
  type SmartCoupon,
} from "@/lib/smart-coupon-engine";
import { resolveCouponSettlement, type CouponSettlement } from "@/lib/smart-coupon-performance";

export type SmartCouponArchiveSummary = {
  published: number;
  duplicatesSkipped: number;
  incompleteSkipped: number;
  pendingEvaluated: number;
  won: number;
  lost: number;
  voided: number;
};

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

export async function publishSmartCoupons(
  coupons: readonly SmartCoupon[],
  now = new Date(),
): Promise<Pick<SmartCouponArchiveSummary, "published" | "duplicatesSkipped" | "incompleteSkipped">> {
  let published = 0;
  let duplicatesSkipped = 0;
  let incompleteSkipped = 0;
  const ranks = new Map<string, number>();
  const candidateMatchIds = [...new Set(coupons.flatMap((coupon) =>
    coupon.legs.map((leg) => leg.matchId)))];
  const archived = candidateMatchIds.length === 0
    ? []
    : await prisma.smartCouponHistory.findMany({
      where: { legs: { some: { matchId: { in: candidateMatchIds } } } },
      select: {
        legs: { select: { matchId: true, marketKey: true, selection: true } },
      },
    });
  const publishedSignatures = new Set(archived.map((coupon) =>
    couponSelectionSignature(coupon)));

  for (const coupon of coupons) {
    if (coupon.legs.some((leg) => leg.valueBetHistoryId === null)) {
      incompleteSkipped += 1;
      continue;
    }
    const selectionSignature = couponSelectionSignature(coupon);
    if (publishedSignatures.has(selectionSignature)) {
      duplicatesSkipped += 1;
      continue;
    }
    const group = `${coupon.window}:${coupon.band}`;
    const rank = (ranks.get(group) ?? 0) + 1;
    ranks.set(group, rank);
    const publicationKey = `${istanbulDateKey(now)}:${group}:${rank}`;
    const exists = await prisma.smartCouponHistory.findUnique({
      where: { publicationKey },
      select: { id: true },
    });
    if (exists) {
      duplicatesSkipped += 1;
      continue;
    }

    await prisma.smartCouponHistory.create({
      data: {
        publicationKey,
        window: coupon.window,
        band: coupon.band,
        title: coupon.title,
        explanation: coupon.explanation,
        riskNote: coupon.riskNote,
        totalOdds: coupon.totalOdds,
        combinedModelProbability: coupon.combinedModelProbability,
        averageModelProbability: coupon.averageModelProbability,
        averageMarketEdge: coupon.averageMarketEdge,
        averageExpectedValue: coupon.averageExpectedValue,
        minimumBookmakerCount: coupon.minimumBookmakerCount,
        pendingLegs: coupon.legs.length,
        publishedAt: now,
        legs: {
          create: coupon.legs.map((leg) => ({
            valueBetHistoryId: leg.valueBetHistoryId!,
            matchId: leg.matchId,
            kickoffAt: leg.kickoffAt,
            leagueName: leg.leagueName,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            marketKey: leg.marketKey,
            market: leg.market,
            selection: leg.selection,
            odds: leg.odds,
            modelProbability: leg.modelProbability,
          })),
        },
      },
    });
    publishedSignatures.add(selectionSignature);
    published += 1;
  }

  return { published, duplicatesSkipped, incompleteSkipped };
}

export async function settleSmartCoupons(
  now = new Date(),
): Promise<Pick<SmartCouponArchiveSummary, "pendingEvaluated" | "won" | "lost" | "voided">> {
  const coupons = await prisma.smartCouponHistory.findMany({
    where: { result: "PENDING" },
    orderBy: { id: "asc" },
    include: {
      legs: {
        include: {
          valueBet: {
            select: {
              result: true,
              actualHomeScore: true,
              actualAwayScore: true,
              settledAt: true,
            },
          },
        },
      },
    },
  });
  const summary = { pendingEvaluated: coupons.length, won: 0, lost: 0, voided: 0 };

  for (const coupon of coupons) {
    const resolved = resolveCouponSettlement(coupon.legs.map((leg) => ({
      result: (["PENDING", "WON", "LOST", "VOID"].includes(leg.valueBet.result)
        ? leg.valueBet.result
        : "VOID") as CouponSettlement,
      odds: leg.odds,
    })));

    await prisma.$transaction([
      ...coupon.legs.map((leg) => prisma.smartCouponLegHistory.update({
        where: { id: leg.id },
        data: {
          result: leg.valueBet.result,
          actualHomeScore: leg.valueBet.actualHomeScore,
          actualAwayScore: leg.valueBet.actualAwayScore,
          settledAt: leg.valueBet.settledAt,
        },
      })),
      prisma.smartCouponHistory.update({
        where: { id: coupon.id },
        data: {
          result: resolved.result,
          profitUnits: resolved.profitUnits,
          wonLegs: resolved.wonLegs,
          lostLegs: resolved.lostLegs,
          voidLegs: resolved.voidLegs,
          pendingLegs: resolved.pendingLegs,
          settledAt: resolved.result === "PENDING" ? null : now,
        },
      }),
    ]);

    if (resolved.result === "WON") summary.won += 1;
    else if (resolved.result === "LOST") summary.lost += 1;
    else if (resolved.result === "VOID") summary.voided += 1;
  }
  return summary;
}

export async function runSmartCouponArchiveAutomation(
  coupons: readonly SmartCoupon[],
  now = new Date(),
): Promise<SmartCouponArchiveSummary> {
  const settlement = await settleSmartCoupons(now);
  const publication = await publishSmartCoupons(coupons, now);
  return { ...publication, ...settlement };
}
