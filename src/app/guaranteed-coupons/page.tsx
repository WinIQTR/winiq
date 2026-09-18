import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth-session";
import { buildSmartCouponCenter } from "@/lib/smart-coupon-engine";
import { serializeCouponCenter } from "@/lib/smart-coupon-view";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import { loadSmartCouponPerformance } from "@/lib/smart-coupon-performance-data";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { GuaranteedCouponWorkspace } from "@/components/guaranteed-coupon-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuaranteedCouponsPage() {
  await requireAdmin();
  const data = await loadValueBetDashboardSnapshot();
  const center = buildSmartCouponCenter(data.upcoming, { historicalRows: data.settled, horizonDays: 28 });
  const serialized = serializeCouponCenter(center);
  const performance = await loadSmartCouponPerformance(500);
  const performanceLegs = performance.rows.flatMap((row) => row.legs.map((leg) => ({ ...leg, result: leg.result })));
  const snapshot = await loadDashboardPredictionSnapshot(20000);
  const snapshotLegs = snapshot.flatMap((prediction) => [
    { matchId: prediction.matchId, kickoffAt: prediction.kickoffAt, leagueName: prediction.leagueName, homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam, market: "Maç Sonucu", marketKey: "MATCH_RESULT", selection: "HOME", odds: prediction.homeProbability ? 100 / prediction.homeProbability : 0, modelProbability: prediction.homeProbability, result: prediction.settlementStatus ?? "PENDING", actualHomeScore: prediction.finalHomeScore ?? null, actualAwayScore: prediction.finalAwayScore ?? null },
    { matchId: prediction.matchId, kickoffAt: prediction.kickoffAt, leagueName: prediction.leagueName, homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam, market: "Maç Sonucu", marketKey: "MATCH_RESULT", selection: "DRAW", odds: prediction.drawProbability ? 100 / prediction.drawProbability : 0, modelProbability: prediction.drawProbability, result: prediction.settlementStatus ?? "PENDING", actualHomeScore: prediction.finalHomeScore ?? null, actualAwayScore: prediction.finalAwayScore ?? null },
    { matchId: prediction.matchId, kickoffAt: prediction.kickoffAt, leagueName: prediction.leagueName, homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam, market: "Maç Sonucu", marketKey: "MATCH_RESULT", selection: "AWAY", odds: prediction.awayProbability ? 100 / prediction.awayProbability : 0, modelProbability: prediction.awayProbability, result: prediction.settlementStatus ?? "PENDING", actualHomeScore: prediction.finalHomeScore ?? null, actualAwayScore: prediction.finalAwayScore ?? null },
    ...(prediction.topPicks ?? []).map((pick) => ({ matchId: prediction.matchId, kickoffAt: prediction.kickoffAt, leagueName: prediction.leagueName, homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam, market: pick.category || pick.market, marketKey: pick.market, selection: pick.selection, odds: pick.fairOdds ?? (pick.probability ? 100 / pick.probability : 0), modelProbability: pick.probability, result: prediction.settlementStatus ?? "PENDING", actualHomeScore: prediction.finalHomeScore ?? null, actualAwayScore: prediction.finalAwayScore ?? null })),
  ]);
  return <PageShell><GuaranteedCouponWorkspace coupons={[...serialized.coupons, ...serialized.fallbackCoupons]} performanceLegs={[...performanceLegs, ...snapshotLegs]} generatedAt={serialized.generatedAt} /></PageShell>;
}
