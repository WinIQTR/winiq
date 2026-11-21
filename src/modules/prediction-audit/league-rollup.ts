/**
 * Per-league rollup: matches, pick hit rate, Brier, home-win rate.
 */

import { computeNaiveBaselines } from "@/modules/prediction-audit/baselines";
import { multiClassBrier } from "@/modules/prediction-audit/scoring";
import type { SettledOneXTwoRow } from "@/modules/prediction-audit/types";

export type LeagueRollup = {
  leagueKey: string;
  leagueName: string;
  country: string | null;
  matches: number;
  pickHitRate: number | null;
  homeWinRate: number | null;
  brier: number | null;
};

export type LeagueRollupSummary = {
  all: {
    matches: number;
    pickHitRate: number | null;
    homeWinRate: number | null;
    brier: number | null;
  };
  leagues: LeagueRollup[];
};

function rollupRows(rows: readonly SettledOneXTwoRow[]): {
  matches: number;
  pickHitRate: number | null;
  homeWinRate: number | null;
  brier: number | null;
} {
  const settled = rows.filter((row) => row.result !== null);
  if (settled.length === 0) {
    return {
      matches: 0,
      pickHitRate: null,
      homeWinRate: null,
      brier: null,
    };
  }
  const baselines = computeNaiveBaselines(settled);
  let brierSum = 0;
  for (const row of settled) {
    brierSum += multiClassBrier(
      row.pHome,
      row.pDraw,
      row.pAway,
      row.result!,
    );
  }
  return {
    matches: settled.length,
    pickHitRate: baselines.modelPickHitRate,
    homeWinRate: baselines.homePickHitRate,
    brier: brierSum / settled.length,
  };
}

export function buildLeagueRollupSummary(
  rows: readonly SettledOneXTwoRow[],
): LeagueRollupSummary {
  const byLeague = new Map<string, SettledOneXTwoRow[]>();
  for (const row of rows) {
    const group = byLeague.get(row.leagueKey) ?? [];
    group.push(row);
    byLeague.set(row.leagueKey, group);
  }

  const leagues: LeagueRollup[] = [...byLeague.entries()]
    .map(([leagueKey, group]) => {
      const stats = rollupRows(group);
      return {
        leagueKey,
        leagueName: group[0]?.leagueName ?? leagueKey,
        country: group[0]?.country ?? null,
        ...stats,
      };
    })
    .sort(
      (a, b) =>
        b.matches - a.matches || a.leagueKey.localeCompare(b.leagueKey),
    );

  return {
    all: rollupRows(rows),
    leagues,
  };
}
