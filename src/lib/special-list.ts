import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import { loadDashboardPredictions } from "@/lib/prediction-dashboard";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import type { DashboardPrediction } from "@/lib/prediction-dashboard-shared";

export type SpecialListRange = "day" | "week";
export type SpecialListDataSource = "LIVE" | "SNAPSHOT";

export type SpecialListCandidate = {
  prediction: DashboardPrediction;
  marketKey: string;
  marketLabel: string;
  selection: string;
  probability: number;
  fairOdds: number;
};

const LIVE_TIMEOUT_MS = 2_500;

export function readableSelection(
  market: string,
  selection: string,
  home: string,
  away: string,
): string {
  const value = selection.toUpperCase();
  const side =
    value === "HOME"
      ? home
      : value === "AWAY"
        ? away
        : value === "NONE"
          ? "Gol yok"
          : selection;
  const line = market.match(/(\d+(?:\.\d+)?)/)?.[1];
  if (/TOTAL_GOALS|TOTAL GOAL|GOL/i.test(market)) {
    return `${value.includes("OVER") || value.includes("ÜST") ? "Üst" : "Alt"}${line ? ` ${line} gol` : ""}`;
  }
  if (/CORNER|KORNER/i.test(market)) {
    return `${value.includes("OVER") || value.includes("ÜST") ? "Üst" : "Alt"}${line ? ` ${line} korner` : ""}`;
  }
  if (/CARD|KART/i.test(market)) {
    return `${value.includes("OVER") || value.includes("ÜST") ? "Üst" : "Alt"}${line ? ` ${line} kart` : ""}`;
  }
  if (/FIRST_GOAL|İLK GOL/i.test(market)) return `İlk gol: ${side}`;
  if (/BTTS|KARŞILIKLI/i.test(market)) {
    return value.includes("YES") || value.includes("EVET")
      ? "Karşılıklı gol: Evet"
      : "Karşılıklı gol: Hayır";
  }
  return side;
}

export function readableMarket(market: string, label: string): string {
  const line = market.match(/(\d+(?:\.\d+)?)/)?.[1];
  if (/TOTAL_GOALS|TOTAL GOAL|GOL/i.test(market)) {
    return `Toplam gol · Alt/Üst${line ? ` ${line}` : ""}`;
  }
  if (/CORNER|KORNER/i.test(market)) {
    return `Toplam korner · Alt/Üst${line ? ` ${line}` : ""}`;
  }
  if (/CARD|KART/i.test(market)) {
    return `Toplam kart · Alt/Üst${line ? ` ${line}` : ""}`;
  }
  return label;
}

export function confidenceTier(score: number): "Güçlü" | "Orta" | "Zayıf" {
  if (score >= 70) return "Güçlü";
  if (score >= 55) return "Orta";
  return "Zayıf";
}

/** Mockup-facing confidence labels for Special List rows. */
export function confidenceLabel(
  score: number,
): "very-high" | "high" | "medium" | "low" {
  if (score >= 80) return "very-high";
  if (score >= 70) return "high";
  if (score >= 55) return "medium";
  return "low";
}

/**
 * Prefer the precomputed snapshot so Special List never blocks on a cold
 * `calculateDashboardPredictions()` (that path can hang the RSC loading UI).
 * Optionally race a short live refresh when the in-memory cache is warm.
 */
export async function loadSpecialListPredictions(): Promise<{
  predictions: DashboardPrediction[];
  source: SpecialListDataSource;
}> {
  const snapshot = await loadDashboardPredictionSnapshot(10_000);

  // Snapshot-first: never start a cold live recompute on this request path.
  // `loadDashboardPredictions()` can hang for minutes and kept root
  // `loading.tsx` ("Sayfa hazırlanıyor") forever on production /special.
  // Also do not fire-and-forget live work here — unawaited promises can
  // keep the RSC request open in Next/React.
  if (snapshot.length > 0) {
    return { predictions: snapshot, source: "SNAPSHOT" };
  }

  try {
    const live = await Promise.race([
      loadDashboardPredictions(10_000),
      new Promise<DashboardPrediction[]>((_, reject) => {
        setTimeout(() => reject(new Error("live-timeout")), LIVE_TIMEOUT_MS);
      }),
    ]);
    if (live.length > 0) {
      return { predictions: live, source: "LIVE" };
    }
  } catch {
    // Empty snapshot + slow/failed live → empty list, not infinite loading.
  }

  return { predictions: snapshot, source: "SNAPSHOT" };
}

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function teamKey(prediction: DashboardPrediction, side: "home" | "away") {
  const id = side === "home" ? prediction.homeTeamId : prediction.awayTeamId;
  if (id != null) return `id:${id}`;
  const name = (side === "home" ? prediction.homeTeam : prediction.awayTeam)
    .trim()
    .toLocaleLowerCase("tr-TR");
  return `name:${name}`;
}

export function filterSpecialMatches(
  all: DashboardPrediction[],
  range: SpecialListRange,
  now = new Date(),
): DashboardPrediction[] {
  const today = dayKey(now);
  const end = new Date(now.getTime() + (range === "week" ? 7 : 1) * 86_400_000);

  const raw = all.filter((prediction) => {
    if (!isDateInSeason(prediction.kickoffAt, ACTIVE_SEASON_YEAR)) return false;
    if (prediction.settlementStatus && prediction.settlementStatus !== "PENDING") {
      return false;
    }
    if (range === "day") return dayKey(prediction.kickoffAt) === today;
    return prediction.kickoffAt >= now && prediction.kickoffAt < end;
  });

  const occupied = new Set<string>();
  const seen = new Set<number>();

  return [...raw]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .filter((prediction) => {
      if (seen.has(prediction.matchId)) return false;
      const day = dayKey(prediction.kickoffAt);
      const teams = [teamKey(prediction, "home"), teamKey(prediction, "away")];
      if (teams.some((team) => occupied.has(`${day}|${team}`))) return false;
      seen.add(prediction.matchId);
      teams.forEach((team) => occupied.add(`${day}|${team}`));
      return true;
    });
}

export function buildSpecialMarketMap(matches: DashboardPrediction[]): Map<string, string> {
  const marketMap = new Map<string, string>([["DRAW", "Beraberlik (X)"]]);
  for (const prediction of matches) {
    for (const row of [
      ...(prediction.popularMarketsSummary ?? []),
      ...(prediction.topPicks ?? []),
    ]) {
      if (!row.market) continue;
      marketMap.set(
        row.market,
        readableMarket(row.market, "label" in row ? row.label : row.market),
      );
    }
  }
  return marketMap;
}

export function buildSpecialCandidates(
  matches: DashboardPrediction[],
  market: string,
  options?: { minProb?: number | null; maxProb?: number | null },
): SpecialListCandidate[] {
  const minProb = options?.minProb ?? null;
  const maxProb = options?.maxProb ?? null;

  const candidates = matches.flatMap((prediction) => {
    const make = (
      marketKey: string,
      label: string,
      selection: string,
      probability: number,
      fairOdds: number | null,
    ): SpecialListCandidate => ({
      prediction,
      marketKey,
      marketLabel: readableMarket(marketKey, label),
      selection: readableSelection(
        marketKey,
        selection,
        prediction.homeTeam,
        prediction.awayTeam,
      ),
      probability,
      fairOdds: fairOdds ?? (probability ? 100 / probability : 0),
    });

    if (market === "DRAW") {
      return prediction.drawProbability > 0
        ? [make("DRAW", "Beraberlik (X)", "DRAW", prediction.drawProbability, null)]
        : [];
    }

    const source = [
      ...(prediction.popularMarketsSummary ?? []),
      ...(prediction.topPicks ?? []),
    ].filter(
      (row) =>
        (!("supported" in row) || row.supported !== false) &&
        typeof row.probability === "number" &&
        row.market,
    );

    const selected =
      market === "ALL" ? source : [source.find((row) => row.market === market)].filter(Boolean);

    const unique = new Map<string, (typeof source)[number]>();
    for (const row of selected) {
      if (!row?.market) continue;
      const key = `${row.market}|${row.selection ?? ("label" in row ? row.label : row.market)}`;
      if (!unique.has(key) || (row.probability ?? 0) > (unique.get(key)?.probability ?? 0)) {
        unique.set(key, row);
      }
    }

    return [...unique.values()].map((row) =>
      make(
        row.market!,
        "label" in row ? row.label : row.market!,
        row.selection ?? ("label" in row ? row.label : row.market!),
        row.probability!,
        row.fairOdds ?? null,
      ),
    );
  });

  return candidates.filter(
    (row) =>
      row.probability > 0 &&
      (minProb == null || row.probability >= minProb) &&
      (maxProb == null || row.probability <= maxProb),
  );
}

/** Minimum model-% chips: All (null) or ≥N%. */
export const SPECIAL_PROB_MIN_CHIPS = [50, 60, 70, 80, 90, 100] as const;
export type SpecialProbMinChip = (typeof SPECIAL_PROB_MIN_CHIPS)[number];

export const SPECIAL_ODDS_BANDS = [
  { id: "lt120", min: null, max: 1.2 },
  { id: "120_160", min: 1.2, max: 1.6 },
  { id: "160_190", min: 1.6, max: 1.9 },
  { id: "190_250", min: 1.9, max: 2.5 },
  { id: "250_300", min: 2.5, max: 3.0 },
  { id: "300p", min: 3.0, max: null },
] as const;

export type SpecialOddsBandId = (typeof SPECIAL_ODDS_BANDS)[number]["id"];

export function parseSpecialProbMin(value?: string | null): SpecialProbMinChip | null {
  const n = Number(value);
  return (SPECIAL_PROB_MIN_CHIPS as readonly number[]).includes(n)
    ? (n as SpecialProbMinChip)
    : null;
}

export function parseSpecialOddsBand(value?: string | null): SpecialOddsBandId | null {
  return SPECIAL_ODDS_BANDS.some((band) => band.id === value)
    ? (value as SpecialOddsBandId)
    : null;
}

function matchesOddsBand(fairOdds: number, bandId: SpecialOddsBandId): boolean {
  const band = SPECIAL_ODDS_BANDS.find((item) => item.id === bandId);
  if (!band || !Number.isFinite(fairOdds) || fairOdds <= 0) return false;
  if (band.min == null) return fairOdds < (band.max as number);
  if (band.max == null) return fairOdds >= band.min;
  return fairOdds >= band.min && fairOdds < band.max;
}

/** Apply chip filters after candidates are built. */
export function applySpecialChipFilters(
  candidates: SpecialListCandidate[],
  options: {
    probMin?: SpecialProbMinChip | null;
    oddsBand?: SpecialOddsBandId | null;
  },
): SpecialListCandidate[] {
  const probMin = options.probMin ?? null;
  const oddsBand = options.oddsBand ?? null;
  return candidates.filter((row) => {
    if (probMin != null && row.probability < probMin) return false;
    if (oddsBand != null && !matchesOddsBand(row.fairOdds, oddsBand)) return false;
    return true;
  });
}

export function sortSpecialCandidates(
  candidates: SpecialListCandidate[],
  options: { sortDate?: boolean; sortProb?: boolean; sortOdds?: boolean },
): SpecialListCandidate[] {
  const stages: Array<(a: SpecialListCandidate, b: SpecialListCandidate) => number> = [];
  if (options.sortDate) {
    stages.push(
      (a, b) => a.prediction.kickoffAt.getTime() - b.prediction.kickoffAt.getTime(),
    );
  }
  if (options.sortProb) stages.push((a, b) => b.probability - a.probability);
  if (options.sortOdds) stages.push((a, b) => a.fairOdds - b.fairOdds);
  if (!stages.length) stages.push((a, b) => b.probability - a.probability);

  return [...candidates].sort((a, b) => {
    for (const compare of stages) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}
