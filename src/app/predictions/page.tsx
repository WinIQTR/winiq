import {
  PageShell,
} from "@/components/page-shell";

import {
  PredictionsWorkspace,
} from "@/components/predictions-workspace";

import {
  ACTIVE_SEASON_YEAR,
  isDateInSeason,
} from "@/config/season";

import {
  loadDashboardPredictionSnapshot,
} from "@/lib/prediction-dashboard-snapshot";

import {
  prisma,
} from "@/lib/prisma";

import {
  loadPredictionSelectionAuditSnapshot,
} from "@/lib/prediction-selection-audit-snapshot";

import {
  buildTeamFormMap,
} from "@/lib/team-recent-form";

import styles from "./predictions-page.module.css";

export default async function PredictionsPage() {
  const pageLoadedAt = new Date();

  const seasonFixtures =
    await prisma.match.findMany({
      where: {
        season: {
          year:
            ACTIVE_SEASON_YEAR,
        },

        kickoffAt: {
          gt: pageLoadedAt,
        },

        status: {
          in: ["SCHEDULED"],
        },

        homeScore: null,
        awayScore: null,
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        status:
          true,

        homeScore:
          true,

        awayScore:
          true,

        season: {
          select: {
            league: {
              select: {
                apiId:
                  true,

                name:
                  true,
              },
            },
          },
        },

        homeTeam: {
          select: {
            id:
              true,

            name:
              true,

            logoUrl:
              true,
          },
        },

        awayTeam: {
          select: {
            id:
              true,

            name:
              true,

            logoUrl:
              true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      take:
        5_000,
    });

  const teamFormMap =
    await buildTeamFormMap(
      ACTIVE_SEASON_YEAR,
      pageLoadedAt,
    );

  const fixtures =
    seasonFixtures.map(
      (match) => ({
        matchId:
          match.id,

        kickoffAt:
          match.kickoffAt,

        status:
          match.status,

        leagueApiId:
          match.season.league.apiId,

        leagueName:
          match.season.league.name,

        homeTeam:
          match.homeTeam.name,

        awayTeam:
          match.awayTeam.name,

        homeTeamLogo:
          match.homeTeam.logoUrl,

        awayTeamLogo:
          match.awayTeam.logoUrl,

        homeForm:
          teamFormMap.get(match.homeTeam.id) ?? [],

        awayForm:
          teamFormMap.get(match.awayTeam.id) ?? [],

        homeScore:
          match.homeScore,

        awayScore:
          match.awayScore,
      }),
    );

  const snapshotPredictions =
    await loadDashboardPredictionSnapshot(
      5_000,
    );

  const selectionAudits =
    await loadPredictionSelectionAuditSnapshot(
      20_000,
    );

  const currentFixtureById = new Map(
    fixtures.map((fixture) => [fixture.matchId, fixture]),
  );

  const predictions = snapshotPredictions.filter((prediction) => {
    const fixture = currentFixtureById.get(prediction.matchId);

    if (!fixture) return false;

    return (
      isDateInSeason(prediction.kickoffAt, ACTIVE_SEASON_YEAR) &&
      prediction.kickoffAt.getTime() > pageLoadedAt.getTime() &&
      Math.abs(prediction.kickoffAt.getTime() - fixture.kickoffAt.getTime()) < 60_000 &&
      prediction.homeTeam === fixture.homeTeam &&
      prediction.awayTeam === fixture.awayTeam &&
      prediction.leagueApiId === fixture.leagueApiId
    );
  });

  const chronologicalPredictions =
    [...predictions].sort(
      (
        first,
        second,
      ) =>
        first.kickoffAt.getTime() -
        second.kickoffAt.getTime(),
    );

  return (
    <PageShell>
      <header className={`topbar ${styles.predictionsTopbar}`}>
        <div>
          <p className="eyebrow">
            AI FOOTBALL PREDICTIONS
            {" • "}
            {ACTIVE_SEASON_YEAR}
          </p>

          <h1>
            Production Predictions
          </h1>

          <p className="subtitle">
            Official picks, the complete fixture archive and final results from
            the locked 20% ML / 80% Poisson model in one workspace.
          </p>
        </div>

        <span className="mode-badge">
          PUBLISHED DATA
        </span>
      </header>

      {predictions.length === 0 &&
      fixtures.length === 0 ? (
        <section className="empty-state">
          <h2>
            No 2026 Season Matches
          </h2>

          <p>
            No fixture or published prediction is available for the active
            2026 season.
          </p>

          <p>
            Run the production refresh to import fixtures and publish the next
            prediction snapshot.
          </p>
        </section>
      ) : (
        <section className={`dashboard-section ${styles.matchCenter}`}>
          <div className={`dashboard-section-header ${styles.matchCenterHeader}`}>
            <div>
              <p className="eyebrow">
                SMART MATCH CENTER
              </p>

              <h2>
                Explore Matches
              </h2>

              <p className="dashboard-muted">
                Published picks are green; advisory-only matches are amber.
                Search by team, choose a league, or switch directly between
                recommendations, the full schedule and completed matches.
              </p>
            </div>
          </div>

          <PredictionsWorkspace
            predictions={
              chronologicalPredictions
            }
            fixtures={fixtures}
            selectionAudits={selectionAudits}
          />
        </section>
      )}

      <div className="dashboard-disclaimer">
        DRAW signals are retained for audit purposes only and do not alter the
        production outcome. Displayed fair odds are calculated from model
        probabilities and are not bookmaker odds.
      </div>
    </PageShell>
  );
}
