/**
 * Bookmaker margin index — 30-day window, soft / exchange / etalon.
 */

import type { BookmakerKind } from "@/modules/track-record/types";

export type MarginSample = {
  bookmaker: string;
  kind: BookmakerKind;
  /** 1X2 overround as fraction (e.g. 0.05 = 5%). */
  margin: number;
  leagueKey?: string | null;
  at: Date;
};

export type BookmakerMarginRow = {
  name: string;
  kind: BookmakerKind;
  avgMargin: number;
  matches: number;
};

export type MarginIndex = {
  windowDays: number;
  generatedAt: Date;
  matchesSampled: number;
  bookmakers: BookmakerMarginRow[];
  byLeague: Record<
    string,
    { avgMargin: number; matches: number; bookmakers: number }
  >;
};

/** Overround from decimal 1X2 odds. */
export function oneXTwoMargin(home: number, draw: number, away: number): number {
  if (!(home > 1 && draw > 1 && away > 1)) {
    return Number.NaN;
  }
  return 1 / home + 1 / draw + 1 / away - 1;
}

export function buildMarginIndex(
  samples: readonly MarginSample[],
  options?: { windowDays?: number; now?: Date },
): MarginIndex {
  const windowDays = options?.windowDays ?? 30;
  const now = options?.now ?? new Date();
  const cutoff = now.getTime() - windowDays * 86_400_000;
  const recent = samples.filter(
    (sample) =>
      sample.at.getTime() >= cutoff && Number.isFinite(sample.margin),
  );

  const byBook = new Map<string, { kind: BookmakerKind; sum: number; n: number }>();
  const byLeague = new Map<string, { sum: number; n: number; books: Set<string> }>();

  for (const sample of recent) {
    const book = byBook.get(sample.bookmaker) ?? {
      kind: sample.kind,
      sum: 0,
      n: 0,
    };
    book.sum += sample.margin;
    book.n += 1;
    byBook.set(sample.bookmaker, book);

    if (sample.leagueKey) {
      const league = byLeague.get(sample.leagueKey) ?? {
        sum: 0,
        n: 0,
        books: new Set<string>(),
      };
      league.sum += sample.margin;
      league.n += 1;
      league.books.add(sample.bookmaker);
      byLeague.set(sample.leagueKey, league);
    }
  }

  const bookmakers: BookmakerMarginRow[] = [...byBook.entries()]
    .map(([name, row]) => ({
      name,
      kind: row.kind,
      avgMargin: row.sum / row.n,
      matches: row.n,
    }))
    .sort((a, b) => a.avgMargin - b.avgMargin || a.name.localeCompare(b.name));

  const byLeagueOut: MarginIndex["byLeague"] = {};
  for (const [key, row] of byLeague.entries()) {
    byLeagueOut[key] = {
      avgMargin: row.sum / row.n,
      matches: row.n,
      bookmakers: row.books.size,
    };
  }

  return {
    windowDays,
    generatedAt: now,
    matchesSampled: recent.length,
    bookmakers,
    byLeague: byLeagueOut,
  };
}
