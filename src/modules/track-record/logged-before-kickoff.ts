/**
 * Explicit pre-kickoff audit flag (TipsAudit logged_before_kickoff).
 */

export function isLoggedBeforeKickoff(
  loggedAt: Date,
  kickoffAt: Date,
): boolean {
  return loggedAt.getTime() < kickoffAt.getTime();
}

export function loggedBeforeKickoffRate(
  rows: readonly { loggedBeforeKickoff: boolean }[],
): number | null {
  if (rows.length === 0) return null;
  const ok = rows.filter((row) => row.loggedBeforeKickoff).length;
  return ok / rows.length;
}
