import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSmartCouponCenter, couponSelectionSignature } from "../src/lib/smart-coupon-engine";
import type { ValueBetDashboardRow } from "../src/lib/value-bet-dashboard-snapshot";
import {
  hasMembershipPermission,
  MEMBERSHIP_PERMISSIONS,
} from "../src/lib/membership-access";

const engine = readFileSync(resolve(process.cwd(), "src/lib/smart-coupon-engine.ts"), "utf8");
const workspace = readFileSync(resolve(process.cwd(), "src/components/smart-coupon-workspace.tsx"), "utf8");
const adminPage = readFileSync(resolve(process.cwd(), "src/app/coupons/page.tsx"), "utf8");
const memberPage = readFileSync(resolve(process.cwd(), "src/app/member/coupons/page.tsx"), "utf8");
const plans = readFileSync(resolve(process.cwd(), "src/lib/membership-commerce.ts"), "utf8");
const sidebar = readFileSync(resolve(process.cwd(), "src/components/app-sidebar.tsx"), "utf8");

assert.match(engine, /MINIMUM_BOOKMAKER_ODDS = 1\.1/);
assert.match(engine, /MINIMUM_BOOKMAKER_COUNT = 3/);
assert.match(engine, /evaluateOddsFreshness/);
assert.match(engine, /strongestPerMatch/);
assert.match(engine, /buildHistoricalMap/);
assert.match(engine, /row\.result === "PENDING"/);
assert.match(engine, /row\.kickoffAt >= now/);
assert.match(workspace, /Az Maç, Güçlü Seçim/);
assert.match(workspace, /2–5 · Yüksek Güven/);
assert.match(workspace, /5–10 · Dengeli/);
assert.match(workspace, /10–30 · Sürpriz/);
assert.match(workspace, /2–10 · Zayıf \/ Önerilmez/);
assert.match(workspace, /RESMÎ ÖNERİ DEĞİL/);
assert.match(workspace, /Neden seçimler elendi\?/);
assert.match(workspace, /Eski oran/);
assert.match(workspace, /Neden bu kupon\?/);
assert.match(workspace, /kazanç garantisi değildir/);
assert.match(adminPage, /access="ADMIN"/);
assert.match(adminPage, /requireAdmin/);
assert.match(memberPage, /requireMember/);
assert.match(memberPage, /access=\{user\.plan\}/);
assert.match(plans, /Günlük 2–5 oran aralığı kuponu/);
assert.match(plans, /Sürpriz kuponlar/);
assert.match(sidebar, /href: "\/coupons"/);

assert.equal(hasMembershipPermission("BASIC", "DAILY_COUPONS"), true);
assert.equal(hasMembershipPermission("BASIC", "WEEKLY_COUPONS"), false);
assert.equal(hasMembershipPermission("ANALYSIS", "BALANCED_COUPONS"), true);
assert.equal(hasMembershipPermission("ANALYSIS", "SURPRISE_COUPONS"), false);
assert.equal(hasMembershipPermission("PROFESSIONAL", "SURPRISE_COUPONS"), true);
assert.ok(MEMBERSHIP_PERMISSIONS.PROFESSIONAL.includes("COUPON_ANALYTICS"));

function row(
  matchId: number,
  odds: number,
  probability: number,
  kickoffAt = new Date("2026-09-06T16:00:00.000Z"),
): ValueBetDashboardRow {
  return {
    id: matchId,
    matchId,
    leagueApiId: 39,
    leagueName: matchId % 2 === 0 ? "Premier League" : "La Liga",
    kickoffAt,
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    marketKey: `market-${matchId}`,
    market: "Toplam Gol 1.5",
    selection: "ÜST",
    modelProbability: probability,
    fairOdds: 100 / probability,
    bestOdds: odds,
    medianOdds: odds - 0.05,
    marketProbability: probability - 5,
    marketEdge: 5,
    expectedValue: 8,
    valueScore: 78,
    recommendedStakePercentage: 1,
    bookmakerName: "Test Bookmaker",
    bookmakerCount: 5,
    valueLevel: "HIGH",
    sourceUpdatedAt: new Date("2026-09-06T10:00:00.000Z"),
    capturedAt: new Date("2026-09-06T10:00:00.000Z"),
    result: "PENDING",
    profitUnits: null,
    actualHomeScore: null,
    actualAwayScore: null,
    publishedAt: new Date("2026-09-06T10:00:00.000Z"),
    settledAt: null,
  };
}

const now = new Date("2026-09-06T11:00:00.000Z");
const rows = [
  row(1, 1.55, 72), row(2, 1.62, 70), row(3, 1.72, 68),
  row(4, 1.82, 65), row(5, 1.92, 61), row(6, 2.05, 58),
  row(7, 1.65, 57, new Date("2026-09-09T16:00:00.000Z")),
  row(8, 1.85, 55, new Date("2026-09-10T16:00:00.000Z")),
  { ...row(9, 1.8, 43), expectedValue: 1, marketEdge: 0.5 },
  { ...row(10, 1.9, 42), expectedValue: -1, marketEdge: -0.5 },
];

const history = Array.from({ length: 12 }, (_, index) => ({
  ...row(200 + index, 1.7, 68, new Date("2026-08-20T16:00:00.000Z")),
  marketKey: "market-1",
  selection: "ÜST",
  result: index < 9 ? "WON" as const : "LOST" as const,
}));
const center = buildSmartCouponCenter(rows, { now, historicalRows: history });
assert.equal(center.eligibleCandidates, rows.length);
assert.equal(center.advisoryCandidates, 0);
assert.ok(center.coupons.some((coupon) => coupon.window === "DAILY" && coupon.band === "SAFE"));
assert.ok(center.coupons.some((coupon) => coupon.window === "DAILY" && coupon.band === "BALANCED"));
assert.ok(center.coupons.some((coupon) => coupon.window === "DAILY" && coupon.band === "SURPRISE"));
assert.ok(center.coupons.some((coupon) => coupon.window === "DAILY" && coupon.band === "WEAK"));
assert.equal(
  new Set(center.coupons.map(couponSelectionSignature)).size,
  center.coupons.length,
  "Aynı seçimlerden oluşan günlük ve haftalık kuponlar tekrarlanmamalı",
);
assert.ok(center.coupons.flatMap((coupon) => coupon.legs).some((leg) =>
  leg.matchId === 1 && leg.historicalSamples === 12 && leg.historicalHitRate === 75));

for (const coupon of center.coupons) {
  assert.ok(coupon.legs.length >= 2);
  assert.equal(new Set(coupon.legs.map((leg) => leg.matchId)).size, coupon.legs.length);
  assert.ok(coupon.legs.every((leg) => leg.odds >= 1.1));
  if (coupon.band === "SAFE") assert.ok(coupon.totalOdds >= 2 && coupon.totalOdds <= 5);
  if (coupon.band === "BALANCED") assert.ok(coupon.totalOdds >= 5 && coupon.totalOdds <= 10);
  if (coupon.band === "SURPRISE") assert.ok(coupon.totalOdds >= 10 && coupon.totalOdds <= 30);
  if (coupon.band === "WEAK") {
    assert.ok(coupon.totalOdds >= 2 && coupon.totalOdds <= 10);
    assert.ok(coupon.legs.every((leg) =>
      leg.modelProbability < 55 || leg.expectedValue < 3 || leg.marketEdge < 2));
  }
}

const rejected = buildSmartCouponCenter([
  { ...row(90, 1.05, 80), bookmakerCount: 10 },
  { ...row(91, 2, 80), bookmakerCount: 1 },
  { ...row(92, 2, 80), result: "WON" },
  row(93, 2, 80, new Date("2026-09-05T16:00:00.000Z")),
  {
    ...row(94, 2, 80, new Date("2026-09-10T16:00:00.000Z")),
    sourceUpdatedAt: new Date("2026-08-01T10:00:00.000Z"),
    capturedAt: new Date("2026-08-01T10:00:00.000Z"),
  },
], { now });
assert.equal(rejected.eligibleCandidates, 0);
assert.equal(rejected.advisoryCandidates, 1);
assert.equal(rejected.rejectedCandidates, 4);

const staleButVisible = buildSmartCouponCenter([
  {
    ...row(95, 1.8, 70),
    sourceUpdatedAt: new Date("2026-09-04T10:00:00.000Z"),
    capturedAt: new Date("2026-09-04T10:00:00.000Z"),
  },
  {
    ...row(96, 1.9, 68),
    sourceUpdatedAt: new Date("2026-09-04T10:00:00.000Z"),
    capturedAt: new Date("2026-09-04T10:00:00.000Z"),
  },
], { now });
assert.equal(staleButVisible.eligibleCandidates, 0);
assert.equal(staleButVisible.advisoryCandidates, 2);
assert.equal(staleButVisible.rejectedCandidates, 0);
assert.equal(staleButVisible.rejectionBreakdown.staleOdds, 2);
const staleWeakCoupon = staleButVisible.coupons.find((coupon) => coupon.band === "WEAK");
assert.ok(staleWeakCoupon);
assert.ok(staleWeakCoupon.legs.every((leg) => leg.warnings.includes("Oran güncel değil")));

console.log("V9.5.3 smart coupon diagnostics and controlled weak fallback tests passed.");
