import styles from "@/app/member/professional/professional.module.css";

export type RecentMatchStatSide = {
  shots: number | null;
  shotsOnTarget: number | null;
  possession: number | null;
  corners: number | null;
  yellowCards: number | null;
  expectedGoals: number | null;
};

export type RecentMatchRow = {
  id: number;
  kickoffLabel: string;
  leagueName: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  homeStats: RecentMatchStatSide | null;
  awayStats: RecentMatchStatSide | null;
};

/** One row per match; click opens stats panel for that match only — no duplicate fixture lines. */
export function MemberRecentResults({
  matches,
  title = "Past matches and stats",
  subtitle,
  badge = "Verified results",
}: {
  matches: RecentMatchRow[];
  title?: string;
  subtitle?: string;
  badge?: string;
}) {
  const unique = [...new Map(matches.map((match) => [match.id, match])).values()];

  return (
    <section className={`${styles.panel} ${styles.history}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <small>
            {subtitle ??
              `Last ${unique.length} matches for the selected league or team`}
          </small>
        </div>
        <span>{badge}</span>
      </header>
      <div className={styles.historyList}>
        {unique.length === 0 ? (
          <p className={styles.historyEmpty}>No finished matches in this filter.</p>
        ) : (
          unique.map((match) => {
            const score =
              match.homeScore == null || match.awayScore == null
                ? "–"
                : `${match.homeScore} – ${match.awayScore}`;
            const home = match.homeStats;
            const away = match.awayStats;
            return (
              <details key={match.id} name="member-recent-result">
                <summary>
                  <small>
                    {match.kickoffLabel} · {match.leagueName}
                  </small>
                  <b>
                    {match.homeName}
                    <strong>{score}</strong>
                    {match.awayName}
                  </b>
                  <span>Show statistics</span>
                </summary>
                <div>
                  <span>
                    Shots
                    <b>
                      {home?.shots ?? "—"} – {away?.shots ?? "—"}
                    </b>
                  </span>
                  <span>
                    Shots on target
                    <b>
                      {home?.shotsOnTarget ?? "—"} – {away?.shotsOnTarget ?? "—"}
                    </b>
                  </span>
                  <span>
                    Possession
                    <b>
                      {home?.possession ?? "—"}% – {away?.possession ?? "—"}%
                    </b>
                  </span>
                  <span>
                    Corners
                    <b>
                      {home?.corners ?? "—"} – {away?.corners ?? "—"}
                    </b>
                  </span>
                  <span>
                    Cards
                    <b>
                      {home?.yellowCards ?? "—"} – {away?.yellowCards ?? "—"}
                    </b>
                  </span>
                  <span>
                    xG
                    <b>
                      {home?.expectedGoals ?? "—"} – {away?.expectedGoals ?? "—"}
                    </b>
                  </span>
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
