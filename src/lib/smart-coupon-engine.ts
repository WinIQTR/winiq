import type { ValueBetDashboardRow } from "@/lib/value-bet-dashboard-snapshot";
import { evaluateOddsFreshness } from "@/modules/value-bet-engine/odds-freshness";

export type CouponWindow = "DAILY" | "WEEKLY";
export type CouponBand = "SAFE" | "BALANCED" | "SURPRISE" | "WEAK";

export type SmartCouponLeg = {
  valueBetHistoryId: number | null;
  matchId: number;
  kickoffAt: Date;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  market: string;
  selection: string;
  bookmakerName: string;
  odds: number;
  modelProbability: number;
  marketProbability: number;
  marketEdge: number;
  expectedValue: number;
  valueScore: number;
  recommendedStakePercentage: number;
  bookmakerCount: number;
  sourceUpdatedAt: Date;
  historicalHitRate: number | null;
  historicalSamples: number;
  warnings: string[];
};

export type SmartCoupon = {
  id: string;
  window: CouponWindow;
  band: CouponBand;
  title: string;
  explanation: string;
  riskNote: string;
  totalOdds: number;
  combinedModelProbability: number;
  averageModelProbability: number;
  averageMarketEdge: number;
  averageExpectedValue: number;
  minimumBookmakerCount: number;
  oldestSourceUpdatedAt: Date;
  legs: SmartCouponLeg[];
  isFallback?: boolean;
};

export type SmartCouponCenter = {
  generatedAt: Date;
  eligibleCandidates: number;
  advisoryCandidates: number;
  rejectedCandidates: number;
  rejectionBreakdown: {
    startedOrFinished: number;
    outsideSevenDays: number;
    invalidOdds: number;
    insufficientBookmakers: number;
    staleOdds: number;
    invalidProbability: number;
  };
  coupons: SmartCoupon[];
  fallbackCoupons: SmartCoupon[];
  missing: Array<{ window: CouponWindow; band: CouponBand; reason: string }>;
};

type BandPolicy = {
  band: CouponBand;
  title: string;
  minimumOdds: number;
  maximumOdds: number;
  minimumProbability: number;
  minimumExpectedValue: number;
  minimumEdge: number;
  maximumLegs: number;
};

const BAND_POLICIES: readonly BandPolicy[] = [
  {
    band: "SAFE",
    title: "Yüksek Güven · 2–5 Oran",
    minimumOdds: 2,
    maximumOdds: 5,
    minimumProbability: 60,
    minimumExpectedValue: 3,
    minimumEdge: 2,
    maximumLegs: 3,
  },
  {
    band: "BALANCED",
    title: "Dengeli · 5–10 Oran",
    minimumOdds: 5,
    maximumOdds: 10,
    minimumProbability: 55,
    minimumExpectedValue: 3,
    minimumEdge: 2,
    maximumLegs: 4,
  },
  {
    band: "SURPRISE",
    title: "Sürpriz · 10–30 Oran",
    minimumOdds: 10,
    maximumOdds: 30,
    minimumProbability: 45,
    minimumExpectedValue: 3,
    minimumEdge: 2,
    maximumLegs: 5,
  },
  {
    band: "WEAK",
    title: "Zayıf · Önerilmez",
    minimumOdds: 2,
    maximumOdds: 10,
    minimumProbability: 30,
    minimumExpectedValue: Number.NEGATIVE_INFINITY,
    minimumEdge: Number.NEGATIVE_INFINITY,
    maximumLegs: 4,
  },
];

const MINIMUM_BOOKMAKER_ODDS = 1.1;
const MINIMUM_BOOKMAKER_COUNT = 3;
const MAXIMUM_CANDIDATES_PER_POLICY = 18;
const MAXIMUM_COUPONS_PER_FILTER = 3;
const MAXIMUM_CAPTURE_AGE_MINUTES = 2_880;
const MAXIMUM_ADVISORY_AGE_MINUTES = 10_080;

function istanbulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function historyKey(row: ValueBetDashboardRow): string {
  return `${row.marketKey}|${row.selection}`;
}

function buildHistoricalMap(rows: readonly ValueBetDashboardRow[]) {
  const counters = new Map<string, { won: number; settled: number }>();
  for (const row of rows) {
    if (row.result !== "WON" && row.result !== "LOST") continue;
    const key = historyKey(row);
    const current = counters.get(key) ?? { won: 0, settled: 0 };
    current.settled += 1;
    if (row.result === "WON") current.won += 1;
    counters.set(key, current);
  }
  return new Map([...counters.entries()].map(([key, value]) => [key, {
    samples: value.settled,
    hitRate: value.settled > 0 ? value.won / value.settled * 100 : null,
  }]));
}

function rowQuality(
  row: ValueBetDashboardRow,
  histories: ReturnType<typeof buildHistoricalMap>,
): number {
  const history = histories.get(historyKey(row));
  const historicalComponent = history && history.samples >= 10 && history.hitRate !== null
    ? history.hitRate
    : row.modelProbability;
  return (
    row.modelProbability * 0.34 +
    row.valueScore * 0.25 +
    Math.min(Math.max(row.expectedValue, 0), 30) * 0.16 +
    Math.min(Math.max(row.marketEdge, 0), 20) * 0.10 +
    historicalComponent * 0.15
  );
}

function strongestPerMatch(
  rows: readonly ValueBetDashboardRow[],
  histories: ReturnType<typeof buildHistoricalMap>,
): ValueBetDashboardRow[] {
  const byMatch = new Map<number, ValueBetDashboardRow>();
  for (const row of rows) {
    const current = byMatch.get(row.matchId);
    if (!current || rowQuality(row, histories) > rowQuality(current, histories)) byMatch.set(row.matchId, row);
  }
  return [...byMatch.values()].sort((first, second) =>
    rowQuality(second, histories) - rowQuality(first, histories) ||
    first.kickoffAt.getTime() - second.kickoffAt.getTime(),
  );
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  function walk(start: number, selected: T[]): void {
    if (selected.length === size) {
      result.push([...selected]);
      return;
    }
    for (let index = start; index <= items.length - (size - selected.length); index += 1) {
      selected.push(items[index]!);
      walk(index + 1, selected);
      selected.pop();
    }
  }
  walk(0, []);
  return result;
}

function explanation(policy: BandPolicy, legs: readonly SmartCouponLeg[]): string {
  const probability = average(legs.map((leg) => leg.modelProbability));
  const edge = average(legs.map((leg) => leg.marketEdge));
  if (policy.band === "SAFE") {
    return `Az maçla güveni korumak için ${legs.length} güçlü seçim birleştirildi. Ortalama model olasılığı %${probability.toFixed(1)}, piyasa avantajı ${edge.toFixed(1)} puan.`;
  }
  if (policy.band === "BALANCED") {
    return `Toplam oranı yükseltirken güveni dağıtmamak için her maçtan yalnız en güçlü seçim alındı. ${legs.length} seçimde ortalama model olasılığı %${probability.toFixed(1)}.`;
  }
  if (policy.band === "WEAK") {
    const reasons = [...new Set(legs.flatMap((leg) => leg.warnings))];
    return `Bu kupon yalnız karşılaştırma ve model takibi içindir. Uyarılar: ${reasons.join(", ") || "güçlü yayın eşiğini geçemedi"}. Ortalama model olasılığı %${probability.toFixed(1)}; resmî öneri değildir.`;
  }
  return `Daha yüksek getiri hedefiyle pozitif değer taşıyan seçimler birleştirildi. Olasılık daha düşüktür; bu kupon küçük bütçe ve yüksek risk yaklaşımı içindir.`;
}

function riskNote(band: CouponBand): string {
  if (band === "SAFE") return "Görece düşük risk; kesin sonuç garantisi değildir.";
  if (band === "BALANCED") return "Orta risk; kupondaki bütün seçimlerin gerçekleşmesi gerekir.";
  if (band === "WEAK") return "ZAYIF / ÖNERİLMEZ: Güven veya değer eşiğini geçmez; yalnız izleme amaçlıdır.";
  return "Yüksek risk; ana kupon yerine sınırlı bütçeyle değerlendirilmelidir.";
}

function rowKey(row: ValueBetDashboardRow): string {
  return `${row.matchId}:${row.marketKey}:${row.selection}`;
}

export function couponSelectionSignature(
  coupon: { legs: ReadonlyArray<Pick<SmartCouponLeg, "matchId" | "marketKey" | "selection">> },
): string {
  return coupon.legs
    .map((leg) => `${leg.matchId}:${leg.marketKey}:${leg.selection.trim().toLocaleLowerCase("tr-TR")}`)
    .sort()
    .join("|");
}

function deduplicateCoupons(coupons: readonly SmartCoupon[]): SmartCoupon[] {
  const signatures = new Set<string>();
  const result: SmartCoupon[] = [];

  // DAILY is intentionally preferred. A weekly coupon containing exactly the
  // same selections is not a second recommendation; it is the same coupon in
  // a wider date filter.
  for (const coupon of [...coupons].sort((first, second) =>
    (first.window === "DAILY" ? 0 : 1) - (second.window === "DAILY" ? 0 : 1))) {
    const signature = couponSelectionSignature(coupon);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    result.push(coupon);
  }

  return result;
}

function freshnessOf(row: ValueBetDashboardRow, now: Date) {
  return evaluateOddsFreshness({
    now,
    kickoffAt: row.kickoffAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
    capturedAt: row.capturedAt,
    maximumCaptureAgeMinutes: MAXIMUM_CAPTURE_AGE_MINUTES,
  });
}

function weakWarnings(row: ValueBetDashboardRow, now: Date): string[] {
  const freshness = freshnessOf(row, now);
  const warnings: string[] = [];
  if (!freshness.sourceIsFresh || !freshness.captureIsFresh) warnings.push("Oran güncel değil");
  if (row.bookmakerCount < MINIMUM_BOOKMAKER_COUNT) warnings.push("Bookmaker kapsamı yetersiz");
  if (row.modelProbability < 55) warnings.push("Model olasılığı güçlü eşiğin altında");
  if (row.expectedValue < 3) warnings.push("Beklenen değer düşük");
  if (row.marketEdge < 2) warnings.push("Piyasa avantajı düşük");
  return warnings;
}

function toLeg(
  row: ValueBetDashboardRow,
  histories: ReturnType<typeof buildHistoricalMap>,
  now: Date,
): SmartCouponLeg {
  const history = histories.get(historyKey(row));
  return {
    valueBetHistoryId: row.id,
    matchId: row.matchId,
    kickoffAt: row.kickoffAt,
    leagueName: row.leagueName,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    marketKey: row.marketKey,
    market: row.market,
    selection: row.selection,
    bookmakerName: row.bookmakerName,
    odds: row.bestOdds,
    modelProbability: row.modelProbability,
    marketProbability: row.marketProbability,
    marketEdge: row.marketEdge,
    expectedValue: row.expectedValue,
    valueScore: row.valueScore,
    recommendedStakePercentage: row.recommendedStakePercentage,
    bookmakerCount: row.bookmakerCount,
    sourceUpdatedAt: row.sourceUpdatedAt,
    historicalHitRate: history?.hitRate ?? null,
    historicalSamples: history?.samples ?? 0,
    warnings: weakWarnings(row, now),
  };
}

function buildCoupon(
  window: CouponWindow,
  policy: BandPolicy,
  rows: readonly ValueBetDashboardRow[],
  rank: number,
  histories: ReturnType<typeof buildHistoricalMap>,
  now: Date,
): SmartCoupon {
  const legs = rows.map((row) => toLeg(row, histories, now));
  const totalOdds = rows.reduce((total, row) => total * row.bestOdds, 1);
  const combinedModelProbability = rows.reduce(
    (total, row) => total * (row.modelProbability / 100),
    1,
  ) * 100;
  return {
    id: `${window}-${policy.band}-${rank}-${rows.map((row) => row.matchId).join("-")}`,
    window,
    band: policy.band,
    title: policy.title,
    explanation: explanation(policy, legs),
    riskNote: riskNote(policy.band),
    totalOdds: round(totalOdds),
    combinedModelProbability: round(combinedModelProbability, 1),
    averageModelProbability: round(average(rows.map((row) => row.modelProbability)), 1),
    averageMarketEdge: round(average(rows.map((row) => row.marketEdge)), 1),
    averageExpectedValue: round(average(rows.map((row) => row.expectedValue)), 1),
    minimumBookmakerCount: Math.min(...rows.map((row) => row.bookmakerCount)),
    oldestSourceUpdatedAt: new Date(Math.min(...rows.map((row) => row.sourceUpdatedAt.getTime()))),
    legs,
  };
}

function createForPolicy(
  rows: readonly ValueBetDashboardRow[],
  window: CouponWindow,
  policy: BandPolicy,
  histories: ReturnType<typeof buildHistoricalMap>,
  now: Date,
  forcedWeakRows: ReadonlySet<string>,
): SmartCoupon[] {
  const candidates = strongestPerMatch(rows.filter((row) =>
    row.modelProbability >= policy.minimumProbability &&
    row.expectedValue >= policy.minimumExpectedValue &&
    row.marketEdge >= policy.minimumEdge &&
    (policy.band !== "WEAK" ||
      forcedWeakRows.has(rowKey(row)) ||
      row.modelProbability < 55 ||
      row.expectedValue < 3 ||
      row.marketEdge < 2),
  ), histories).slice(0, MAXIMUM_CANDIDATES_PER_POLICY);

  const matching: ValueBetDashboardRow[][] = [];
  for (let size = 2; size <= Math.min(policy.maximumLegs, candidates.length); size += 1) {
    for (const selection of combinations(candidates, size)) {
      const totalOdds = selection.reduce((total, row) => total * row.bestOdds, 1);
      if (totalOdds >= policy.minimumOdds && totalOdds <= policy.maximumOdds) matching.push(selection);
    }
    if (matching.length >= MAXIMUM_COUPONS_PER_FILTER * 6) break;
  }

  matching.sort((first, second) => {
    if (first.length !== second.length) return first.length - second.length;
    const firstProbability = first.reduce((total, row) => total * row.modelProbability / 100, 1);
    const secondProbability = second.reduce((total, row) => total * row.modelProbability / 100, 1);
    return secondProbability - firstProbability ||
      average(second.map((row) => rowQuality(row, histories))) -
      average(first.map((row) => rowQuality(row, histories)));
  });

  const selected: ValueBetDashboardRow[][] = [];
  for (const candidate of matching) {
    const signature = candidate.map((row) => `${row.matchId}:${row.marketKey}`).sort().join("|");
    if (selected.some((existing) => existing.map((row) => `${row.matchId}:${row.marketKey}`).sort().join("|") === signature)) continue;
    selected.push(candidate);
    if (selected.length === MAXIMUM_COUPONS_PER_FILTER) break;
  }

  return selected.map((selection, index) =>
    buildCoupon(window, policy, selection, index + 1, histories, now));
}

export function buildSmartCouponCenter(
  rows: readonly ValueBetDashboardRow[],
  options?: { now?: Date; historicalRows?: readonly ValueBetDashboardRow[] },
): SmartCouponCenter {
  const now = options?.now ?? new Date();
  const histories = buildHistoricalMap(options?.historicalRows ?? []);
  const weeklyEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rejectionBreakdown: SmartCouponCenter["rejectionBreakdown"] = {
    startedOrFinished: 0,
    outsideSevenDays: 0,
    invalidOdds: 0,
    insufficientBookmakers: 0,
    staleOdds: 0,
    invalidProbability: 0,
  };
  const strictEligible: ValueBetDashboardRow[] = [];
  const advisoryEligible: ValueBetDashboardRow[] = [];
  for (const row of rows) {
    const freshness = freshnessOf(row, now);
    const common = row.result === "PENDING" &&
      row.kickoffAt >= now &&
      row.kickoffAt <= weeklyEnd &&
      row.bestOdds >= MINIMUM_BOOKMAKER_ODDS &&
      Number.isFinite(row.bestOdds) &&
      Number.isFinite(row.modelProbability) &&
      row.modelProbability >= 30;
    const strict = common &&
      row.bookmakerCount >= MINIMUM_BOOKMAKER_COUNT &&
      freshness.sourceIsFresh && freshness.captureIsFresh;
    const sourceAgeMinutes = Math.max(0, (now.getTime() - row.sourceUpdatedAt.getTime()) / 60_000);
    const captureAgeMinutes = Math.max(0, (now.getTime() - row.capturedAt.getTime()) / 60_000);
    const advisory = common && row.bookmakerCount >= 1 &&
      sourceAgeMinutes <= MAXIMUM_ADVISORY_AGE_MINUTES &&
      captureAgeMinutes <= MAXIMUM_ADVISORY_AGE_MINUTES;

    if (strict) strictEligible.push(row);
    else if (advisory) advisoryEligible.push(row);

    if (row.result !== "PENDING" || row.kickoffAt < now) rejectionBreakdown.startedOrFinished += 1;
    if (row.kickoffAt > weeklyEnd) rejectionBreakdown.outsideSevenDays += 1;
    if (!Number.isFinite(row.bestOdds) || row.bestOdds < MINIMUM_BOOKMAKER_ODDS) rejectionBreakdown.invalidOdds += 1;
    if (row.bookmakerCount < MINIMUM_BOOKMAKER_COUNT) rejectionBreakdown.insufficientBookmakers += 1;
    if (!freshness.sourceIsFresh || !freshness.captureIsFresh) rejectionBreakdown.staleOdds += 1;
    if (!Number.isFinite(row.modelProbability) || row.modelProbability < 30) rejectionBreakdown.invalidProbability += 1;
  }
  const weakPool = [...strictEligible, ...advisoryEligible];
  const forcedWeakRows = new Set(advisoryEligible.map(rowKey));

  const coupons: SmartCoupon[] = [];
  const fallbackCoupons: SmartCoupon[] = [];
  const missing: SmartCouponCenter["missing"] = [];
  for (const window of ["DAILY", "WEEKLY"] as const) {
    const futureStrictRows = strictEligible.filter((row) =>
      istanbulDateKey(row.kickoffAt) !== istanbulDateKey(now));
    const futureWeakRows = weakPool.filter((row) =>
      istanbulDateKey(row.kickoffAt) !== istanbulDateKey(now));
    const strictWindowRows = strictEligible.filter((row) =>
      window === "DAILY"
        ? istanbulDateKey(row.kickoffAt) === istanbulDateKey(now)
        : (futureStrictRows.length >= 2 ? futureStrictRows : strictEligible).includes(row),
    );
    const weakWindowRows = weakPool.filter((row) =>
      window === "DAILY"
        ? istanbulDateKey(row.kickoffAt) === istanbulDateKey(now)
        : (futureWeakRows.length >= 2 ? futureWeakRows : weakPool).includes(row),
    );
    for (const policy of BAND_POLICIES) {
      const policyRows = policy.band === "WEAK" ? weakWindowRows : strictWindowRows;
      const generated = createForPolicy(policyRows, window, policy, histories, now, forcedWeakRows);
      coupons.push(...generated);
      if (generated.length === 0) {
        missing.push({
          window,
          band: policy.band,
          reason: policyRows.length === 0
            ? policy.band === "WEAK"
              ? "Bu tarih aralığında başlamamış ve son 7 gün içinde hesaplanmış seçim bulunmuyor."
              : "Güncel oran ve bookmaker güvenlik şartlarını geçen başlamamış seçim bulunmuyor."
            : "Hedef oranı kalite eşiklerini bozmadan oluşturan yeterli seçim yok.",
        });
      }
    }
  }

  const uniqueCoupons = deduplicateCoupons(coupons);

  // UI-only fallback coupons keep the centre useful when otherwise valid,
  // upcoming selections miss live publication rules (most often stale odds).
  // They are returned separately so archive jobs never publish them.
  const fallbackBase = strongestPerMatch(rows.filter((row) =>
    row.result === "PENDING" &&
    row.kickoffAt >= now &&
    Number.isFinite(row.bestOdds) &&
    row.bestOdds >= MINIMUM_BOOKMAKER_ODDS &&
    Number.isFinite(row.modelProbability) &&
    row.modelProbability >= 30
  ), histories);
  const nearestDate = fallbackBase[0] ? istanbulDateKey(fallbackBase[0].kickoffAt) : null;
  for (const window of ["DAILY", "WEEKLY"] as const) {
    const windowRows = fallbackBase.filter((row) =>
      window === "DAILY"
        ? nearestDate !== null && istanbulDateKey(row.kickoffAt) === nearestDate
        : row.kickoffAt <= weeklyEnd,
    );
    const legs = windowRows.slice(0, Math.min(3, windowRows.length));
    if (legs.length === 0) continue;
    for (const policy of BAND_POLICIES) {
      if (uniqueCoupons.some((coupon) => coupon.window === window && coupon.band === policy.band)) continue;
      const fallback = buildCoupon(window, policy, legs, 1, histories, now);
      fallbackCoupons.push({
        ...fallback,
        id: `FALLBACK-${fallback.id}`,
        title: `Yakın Maçlardan Alternatif · ${policy.title}`,
        explanation: `Resmî yayın koşullarını geçen kupon bulunamadığı için en yakın maç günündeki ${legs.length} yüksek puanlı seçim gösteriliyor.`,
        riskNote: "ALTERNATİF ÖNERİ: Oran güncelliğini bookmaker üzerinden kontrol edin; resmî güçlü kupon değildir.",
        isFallback: true,
      });
    }
  }
  for (const coupon of coupons) {
    if (uniqueCoupons.some((unique) => unique.window === coupon.window && unique.band === coupon.band)) continue;
    if (missing.some((item) => item.window === coupon.window && item.band === coupon.band)) continue;
    missing.push({
      window: coupon.window,
      band: coupon.band,
      reason: "Aynı seçimler günlük kuponda zaten yayınlandığı için ikinci kez gösterilmedi.",
    });
  }

  return {
    generatedAt: now,
    eligibleCandidates: strictEligible.length,
    advisoryCandidates: advisoryEligible.length,
    rejectedCandidates: rows.length - strictEligible.length - advisoryEligible.length,
    rejectionBreakdown,
    coupons: uniqueCoupons,
    fallbackCoupons,
    missing,
  };
}
