import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProductionDashboardPrediction } from "../src/lib/prediction-dashboard";
import { buildMatchResultFavoriteRows } from "../src/lib/match-result-favorite-performance";
import {
  buildMarketPerformanceArchive,
  MINIMUM_ACCEPTABLE_FAIR_ODDS,
  MARKET_PERFORMANCE_TYPES,
} from "../src/lib/market-performance-archive";
import {
  buildPerformanceInsights,
  summarizePerformance,
} from "../src/lib/market-performance-analytics";

const page = readFileSync(
  resolve(process.cwd(), "src/app/match-result-performance/page.tsx"),
  "utf8",
);
const history = readFileSync(
  resolve(process.cwd(), "src/components/match-result-history.tsx"),
  "utf8",
);
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/market-performance-workspace.tsx"),
  "utf8",
);
const evaluation = readFileSync(
  resolve(process.cwd(), "src/lib/prediction-evaluation.ts"),
  "utf8",
);
const favoritePerformance = readFileSync(
  resolve(process.cwd(), "src/lib/match-result-favorite-performance.ts"),
  "utf8",
);
const sidebar = readFileSync(
  resolve(process.cwd(), "src/components/app-sidebar.tsx"),
  "utf8",
);

assert.match(page, /MarketPerformanceWorkspace/);
assert.match(page, /loadDashboardPredictionSnapshot\(20_000\)/);
assert.match(page, /buildMarketPerformanceArchive/);
assert.match(page, /MARKET_PERFORMANCE_TYPES/);
assert.match(page, /force-dynamic/);
assert.match(page, /revalidate = 0/);
assert.match(page, /PERFORMANCE_START/);
assert.match(page, /Date\.UTC\(2026, 7, 14, 21/);
assert.match(workspace, /27\+ BAHİS TÜRÜ/);
assert.match(workspace, /activeMarket/);
assert.match(workspace, /Hangi Olasılıklar Kazandı/);
assert.match(workspace, /Güçlü \/ Orta \/ Zayıf/);
assert.match(workspace, /BEKLENEN BAŞARI/);
assert.match(workspace, /GERÇEK BAŞARI/);
assert.match(workspace, /KALİBRASYON FARKI/);
assert.match(workspace, /Lig Performansı/);
assert.match(workspace, /MS 1 \/ MS 0 \/ MS 2/);
assert.match(workspace, /Seçim Tarafı Performansı/);
assert.match(workspace, /Kalite Seviyesine Göre Başarı/);
assert.match(workspace, /EN ÇOK KAYBETTİREN LİGLER/);
assert.match(workspace, /EN BAŞARILI YÜZDE ARALIKLARI/);
assert.match(workspace, /ADİL ORAN 1\.10/);
assert.match(workspace, /bookmaker oranı değildir/);
assert.match(workspace, /DATA_MISSING/);
assert.match(workspace, /VERİ BEKLENİYOR/);
assert.match(history, /MS 1 · Ev Sahibi/);
assert.match(history, /MS 0 · Beraberlik/);
assert.match(history, /MS 2 · Deplasman/);
assert.match(history, /Kesin Skor/);
assert.match(history, /KAZANDI/);
assert.match(history, /KAYBETTİ/);
assert.match(history, /probabilityRange/);
assert.match(history, /%30–100 · Tüm favoriler/);
assert.match(favoritePerformance, /MINIMUM_FAVORITE_PROBABILITY = 30/);
assert.match(favoritePerformance, /prediction\.homeProbability/);
assert.match(favoritePerformance, /prediction\.drawProbability/);
assert.match(favoritePerformance, /prediction\.awayProbability/);
assert.match(favoritePerformance, /actualOutcome\(homeScore!, awayScore!\) === favorite\.outcome/);
assert.match(evaluation, /categories\?: string\[\]/);
assert.match(evaluation, /category: \{ in: categories \}/);
assert.match(evaluation, /kickoffRange\?: \{ from\?: Date; to\?: Date \}/);
assert.match(evaluation, /kickoffAt:/);
assert.match(sidebar, /href: "\/match-result-performance"/);
assert.match(sidebar, /Market Performance/);

function fixture(
  matchId: number,
  probabilities: { home: number; draw: number; away: number },
  score: { home: number; away: number },
): ProductionDashboardPrediction {
  return {
    matchId,
    kickoffAt: new Date("2026-08-20T18:00:00.000Z"),
    leagueName: "Test League",
    homeTeam: `Home ${matchId}`,
    awayTeam: `Away ${matchId}`,
    homeProbability: probabilities.home,
    drawProbability: probabilities.draw,
    awayProbability: probabilities.away,
    predictedOutcome: "HOME",
    predictedProbability: probabilities.home,
    confidenceScore: 70,
    dataQualityScore: 65,
    expectedHomeGoals: 1.8,
    expectedAwayGoals: 0.9,
    finalHomeScore: score.home,
    finalAwayScore: score.away,
    settlementStatus: "WON",
  } as unknown as ProductionDashboardPrediction;
}

const favoriteRows = buildMatchResultFavoriteRows(
  [
    fixture(1, { home: 55, draw: 25, away: 20 }, { home: 2, away: 0 }),
    fixture(2, { home: 32, draw: 36, away: 32 }, { home: 1, away: 1 }),
    fixture(3, { home: 25, draw: 28, away: 47 }, { home: 2, away: 1 }),
  ],
  {
    from: new Date("2026-08-15T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
    minimumProbability: 30,
  },
);

assert.deepEqual(
  favoriteRows.map((row) => row.selection),
  ["HOME", "DRAW", "AWAY"],
);
assert.deepEqual(
  favoriteRows.map((row) => row.result),
  ["WON", "WON", "LOST"],
);

assert.equal(MARKET_PERFORMANCE_TYPES.length, 27);

const allMarketRows = buildMarketPerformanceArchive(
  [
    fixture(1, { home: 55, draw: 25, away: 20 }, { home: 2, away: 0 }),
    fixture(2, { home: 32, draw: 36, away: 32 }, { home: 1, away: 1 }),
    fixture(3, { home: 25, draw: 28, away: 47 }, { home: 2, away: 1 }),
  ],
  {
    from: new Date("2026-08-15T00:00:00.000Z"),
    to: new Date("2026-09-30T00:00:00.000Z"),
  },
);

assert.deepEqual(
  allMarketRows
    .filter((row) => row.marketNumber === 1)
    .map((row) => row.optionKey),
  ["ms-1", "ms-0", "ms-2"],
);
assert.ok(allMarketRows.some((row) => row.marketNumber === 2));
assert.ok(allMarketRows.some((row) => row.marketNumber === 5));
assert.ok(allMarketRows.some((row) => row.result === "DATA_MISSING"));
assert.ok(allMarketRows.every((row) => row.confidenceScore === 70));
assert.ok(allMarketRows.every((row) => row.dataQualityScore === 65));
assert.equal(MINIMUM_ACCEPTABLE_FAIR_ODDS, 1.1);

const matchResultRows = allMarketRows.filter((row) => row.marketNumber === 1);
const summary = summarizePerformance(matchResultRows);
assert.equal(summary.settled, 3);
assert.equal(summary.won, 2);
assert.equal(summary.lost, 1);
assert.equal(summary.actualAccuracy?.toFixed(1), "66.7");
assert.equal(summary.expectedAccuracy?.toFixed(1), "46.0");
assert.equal(summary.calibrationGap?.toFixed(1), "20.7");
assert.equal(summary.sampleLevel, "INSUFFICIENT");

const insights = buildPerformanceInsights(matchResultRows);
assert.deepEqual(insights.sides.map((row) => row.key), ["HOME", "DRAW", "AWAY"]);
assert.equal(insights.leagues[0]?.label, "Test League");
assert.equal(insights.quality[0]?.label, "60–74 · Yüksek");
assert.equal(insights.fairOddsPassed + insights.fairOddsBelow, matchResultRows.length);

console.log("V9.4.1 calibrated 27-market performance center tests passed.");
