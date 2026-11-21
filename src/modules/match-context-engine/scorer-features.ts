/**
 * Scorer-derived pre-match features from goal events (shifted history).
 * open-play vs penalty, unique scorers, goal concentration.
 */

export type ScorerGoalEvent = {
  matchId: number | string;
  kickoffAt: Date;
  teamId: string;
  scorerKey: string;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
};

export type TeamScorerSnapshot = {
  window: number;
  matchesUsed: number;
  totalGoals: number;
  openPlayGoals: number;
  penaltyGoals: number;
  ownGoals: number;
  uniqueScorers: number;
  /** topScorerGoals / totalGoals in window (0–1). */
  goalConcentration: number | null;
};

function isOpenPlay(event: ScorerGoalEvent): boolean {
  return !event.isPenalty && !event.isOwnGoal;
}

export function aggregateTeamScorerHistory(
  events: readonly ScorerGoalEvent[],
  teamId: string,
  before: Date,
  windows: readonly number[] = [5, 10, 20],
): TeamScorerSnapshot[] {
  const prior = events
    .filter(
      (event) =>
        event.teamId === teamId &&
        event.kickoffAt.getTime() < before.getTime() &&
        !event.isOwnGoal,
    )
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime());

  const byMatch = new Map<string, ScorerGoalEvent[]>();
  for (const event of prior) {
    const key = String(event.matchId);
    const group = byMatch.get(key) ?? [];
    group.push(event);
    byMatch.set(key, group);
  }

  const matchOrder = [...byMatch.entries()].sort((a, b) => {
    const aDate = a[1][0]?.kickoffAt.getTime() ?? 0;
    const bDate = b[1][0]?.kickoffAt.getTime() ?? 0;
    return bDate - aDate;
  });

  return windows.map((window) => {
    const slice = matchOrder.slice(0, window);
    let totalGoals = 0;
    let openPlayGoals = 0;
    let penaltyGoals = 0;
    let ownGoals = 0;
    const scorers = new Map<string, number>();

    for (const [, goals] of slice) {
      for (const event of goals) {
        if (event.isOwnGoal) {
          ownGoals += 1;
          continue;
        }
        totalGoals += 1;
        if (event.isPenalty) penaltyGoals += 1;
        if (isOpenPlay(event)) openPlayGoals += 1;
        scorers.set(
          event.scorerKey,
          (scorers.get(event.scorerKey) ?? 0) + 1,
        );
      }
    }

    const top = [...scorers.values()].sort((a, b) => b - a)[0] ?? 0;
    return {
      window,
      matchesUsed: slice.length,
      totalGoals,
      openPlayGoals,
      penaltyGoals,
      ownGoals,
      uniqueScorers: scorers.size,
      goalConcentration:
        totalGoals > 0 ? Math.round((top / totalGoals) * 1000) / 1000 : null,
    };
  });
}
