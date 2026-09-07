import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCouponPerformanceReport,
  deduplicateCouponPerformanceRows,
  resolveCouponSettlement,
  type CouponPerformanceRow,
} from "../src/lib/smart-coupon-performance";

const archive = readFileSync(resolve(process.cwd(), "src/lib/smart-coupon-archive.ts"), "utf8");
const workspace = readFileSync(resolve(process.cwd(), "src/components/coupon-performance-workspace.tsx"), "utf8");
const adminPage = readFileSync(resolve(process.cwd(), "src/app/coupon-performance/page.tsx"), "utf8");
const memberPage = readFileSync(resolve(process.cwd(), "src/app/member/coupon-performance/page.tsx"), "utf8");
const refresh = readFileSync(resolve(process.cwd(), "scripts/refresh-production-data.ts"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

assert.match(schema, /model SmartCouponHistory/);
assert.match(schema, /model SmartCouponLegHistory/);
assert.match(archive, /publicationKey/);
assert.match(archive, /duplicatesSkipped/);
assert.match(archive, /settleSmartCoupons/);
assert.match(refresh, /Coupons published/);
assert.match(adminPage, /PageShell/);
assert.match(memberPage, /requireMember/);
assert.match(workspace, /Kupon Performansı/);
assert.match(workspace, /Kazandı/);
assert.match(workspace, /Kaybetti/);
assert.match(workspace, /Bekleyen ve iadeler hariç/);
assert.match(workspace, /Geçmişte kaydedilmemiş kuponlar sonradan uydurulmaz/);

assert.deepEqual(resolveCouponSettlement([
  { result: "WON", odds: 1.8 },
  { result: "WON", odds: 2 },
]), { result: "WON", profitUnits: 2.6, wonLegs: 2, lostLegs: 0, voidLegs: 0, pendingLegs: 0 });
assert.equal(resolveCouponSettlement([
  { result: "WON", odds: 1.8 },
  { result: "LOST", odds: 2 },
]).result, "LOST");
assert.equal(resolveCouponSettlement([
  { result: "WON", odds: 1.8 },
  { result: "PENDING", odds: 2 },
]).result, "PENDING");
assert.deepEqual(resolveCouponSettlement([
  { result: "WON", odds: 2 },
  { result: "VOID", odds: 3 },
]), { result: "WON", profitUnits: 1, wonLegs: 1, lostLegs: 0, voidLegs: 1, pendingLegs: 0 });
assert.equal(resolveCouponSettlement([{ result: "VOID", odds: 2 }]).result, "VOID");

function coupon(id: number, result: CouponPerformanceRow["result"], profitUnits: number | null, band = "SAFE"): CouponPerformanceRow {
  return {
    id, window: "DAILY", band, title: band, totalOdds: 3,
    combinedModelProbability: 50, result, profitUnits,
    publishedAt: new Date(), settledAt: result === "PENDING" ? null : new Date(), legs: [],
  };
}
const report = buildCouponPerformanceReport([
  coupon(1, "WON", 2), coupon(2, "LOST", -1), coupon(3, "PENDING", null), coupon(4, "VOID", 0, "WEAK"),
]);
assert.equal(report.overall.total, 4);
assert.equal(report.overall.settled, 2);
assert.equal(report.overall.winRate, 50);
assert.equal(report.overall.roi, 50);
assert.equal(report.overall.pending, 1);
assert.equal(report.overall.voided, 1);

const duplicatedLeg = {
  id: 1, matchId: 44, kickoffAt: new Date(), leagueName: "Süper Lig",
  homeTeam: "A", awayTeam: "B", market: "Toplam Gol 2.5", marketKey: "total_goals_2_5",
  selection: "UNDER", odds: 1.68, modelProbability: 64.6, result: "PENDING" as const,
  actualHomeScore: null, actualAwayScore: null,
};
const daily = { ...coupon(10, "PENDING", null, "WEAK"), window: "DAILY", legs: [duplicatedLeg] };
const weekly = { ...coupon(11, "PENDING", null, "WEAK"), window: "WEEKLY", legs: [{ ...duplicatedLeg, id: 2 }] };
const unique = deduplicateCouponPerformanceRows([weekly, daily]);
assert.equal(unique.length, 1);
assert.equal(unique[0]?.window, "DAILY");

console.log("V9.5.2 persistent coupon archive, settlement and performance page tests passed.");
