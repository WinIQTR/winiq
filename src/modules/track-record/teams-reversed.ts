/**
 * Fixture home/away swapped after logging — keep logged order, flag integrity.
 */

export type TeamsReversedCheck = {
  teamsReversedAfterLogging: boolean;
  /** When reversed, logged home is not the team that played at home. */
  warning: string | null;
};

export function detectTeamsReversed(options: {
  loggedHome: string;
  loggedAway: string;
  /** Current canonical home after feed correction. */
  canonicalHome?: string | null;
  canonicalAway?: string | null;
}): TeamsReversedCheck {
  const { loggedHome, loggedAway, canonicalHome, canonicalAway } = options;
  if (!canonicalHome || !canonicalAway) {
    return { teamsReversedAfterLogging: false, warning: null };
  }
  const norm = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  const lh = norm(loggedHome);
  const la = norm(loggedAway);
  const ch = norm(canonicalHome);
  const ca = norm(canonicalAway);
  const reversed = lh === ca && la === ch && lh !== ch;
  return {
    teamsReversedAfterLogging: reversed,
    warning: reversed
      ? "teams_reversed_after_logging: row stays in logged order"
      : null,
  };
}
