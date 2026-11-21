/**
 * Opponent-adjusted rolling form with shift(1) leakage safety.
 * Windows default 5 / 10 / 20 (CesarIllescas MIT).
 */

export type FormMatchRow = {
  matchId: number | string;
  kickoffAt: Date;
  teamId: string;
  opponentId: string;
  goalsFor: number;
  goalsAgainst: number;
  /** Opponent Elo before this match (optional). */
  opponentElo?: number | null;
  ownElo?: number | null;
};

export type RollingFormStats = {
  window: number;
  matchesUsed: number;
  pointsPerGame: number | null;
  goalsForPerGame: number | null;
  goalsAgainstPerGame: number | null;
  winRate: number | null;
  /** Points relative to expected vs opponent Elo (null if Elo missing). */
  opponentAdjustedPointsPerGame: number | null;
};

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function points(gf: number, ga: number): number {
  if (gf > ga) return 3;
  if (gf === ga) return 1;
  return 0;
}

function expectedPointsFromElo(
  ownElo: number,
  opponentElo: number,
): number {
  const winProb = 1 / (1 + 10 ** ((opponentElo - ownElo) / 400));
  // Expected points ≈ 3*p_win + 1*p_draw; approximate draw mass 0.25.
  const draw = 0.25;
  const win = winProb * (1 - draw);
  return 3 * win + draw;
}

/**
 * Build rolling stats for one team at a cutoff, excluding the current match
 * (caller must pass only prior matches — equivalent to shift(1)).
 */
export function computeRollingForm(
  priorMatchesNewestFirst: readonly FormMatchRow[],
  windows: readonly number[] = [5, 10, 20],
): RollingFormStats[] {
  return windows.map((window) => {
    const slice = priorMatchesNewestFirst.slice(0, window);
    if (slice.length === 0) {
      return {
        window,
        matchesUsed: 0,
        pointsPerGame: null,
        goalsForPerGame: null,
        goalsAgainstPerGame: null,
        winRate: null,
        opponentAdjustedPointsPerGame: null,
      };
    }

    let pts = 0;
    let gf = 0;
    let ga = 0;
    let wins = 0;
    let adj = 0;
    let adjCount = 0;

    for (const row of slice) {
      const p = points(row.goalsFor, row.goalsAgainst);
      pts += p;
      gf += row.goalsFor;
      ga += row.goalsAgainst;
      if (row.goalsFor > row.goalsAgainst) wins += 1;
      if (
        row.ownElo != null &&
        row.opponentElo != null &&
        Number.isFinite(row.ownElo) &&
        Number.isFinite(row.opponentElo)
      ) {
        adj += p - expectedPointsFromElo(row.ownElo, row.opponentElo);
        adjCount += 1;
      }
    }

    const n = slice.length;
    return {
      window,
      matchesUsed: n,
      pointsPerGame: round(pts / n),
      goalsForPerGame: round(gf / n),
      goalsAgainstPerGame: round(ga / n),
      winRate: round((wins / n) * 100, 1),
      opponentAdjustedPointsPerGame:
        adjCount > 0 ? round(adj / adjCount) : null,
    };
  });
}

/**
 * Split chronological matches into per-team history ending before `before`.
 */
export function priorMatchesForTeam(
  rows: readonly FormMatchRow[],
  teamId: string,
  before: Date,
): FormMatchRow[] {
  return rows
    .filter(
      (row) =>
        row.teamId === teamId && row.kickoffAt.getTime() < before.getTime(),
    )
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime());
}
