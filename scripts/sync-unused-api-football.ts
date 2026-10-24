import "dotenv/config";

import { ACTIVE_COMPETITIONS } from "../src/config/competitions";
import { ACTIVE_SEASON_YEAR } from "../src/config/season";
import { importMatchEventsFromApiFootball } from "../src/modules/importer/football/api-football/import-match-events";
import { importPlayerLeaderboardsFromApiFootball } from "../src/modules/importer/football/api-football/import-player-leaderboards";
import { importStandingsFromApiFootball } from "../src/modules/importer/football/api-football/import-standings";
import { importTeamSeasonStatisticsFromApiFootball } from "../src/modules/importer/football/api-football/import-team-season-statistics";
import { prisma } from "../src/lib/prisma";

/**
 * Quota-aware sync for previously unused API-Football endpoints.
 *
 * Defaults keep Ultra daily spend modest:
 * - standings: 1 call / enabled competition
 * - topscorers + topassists: 2 calls / competition (top 4 by priority)
 * - team statistics: up to 6 teams in top priority league
 * - match events: up to 12 finished matches missing events
 * - venues: refresh from already-imported team.venue* fields (no extra calls)
 */
async function main() {
  const seasonYear = ACTIVE_SEASON_YEAR;
  const enabled = ACTIVE_COMPETITIONS.filter((item) => item.enabled).sort(
    (a, b) => a.priority - b.priority,
  );

  const report: Record<string, unknown> = { seasonYear, steps: [] as unknown[] };

  for (const competition of enabled.slice(0, 8)) {
    try {
      const standings = await importStandingsFromApiFootball({
        leagueApiId: competition.apiId,
        seasonYear,
      });
      (report.steps as unknown[]).push({
        kind: "standings",
        league: competition.shortName,
        ...standings,
      });
    } catch (error) {
      (report.steps as unknown[]).push({
        kind: "standings",
        league: competition.shortName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const competition of enabled.slice(0, 4)) {
    try {
      const boards = await importPlayerLeaderboardsFromApiFootball({
        leagueApiId: competition.apiId,
        seasonYear,
        kinds: ["TOP_SCORERS", "TOP_ASSISTS"],
      });
      (report.steps as unknown[]).push({
        kind: "leaderboards",
        league: competition.shortName,
        ...boards,
      });
    } catch (error) {
      (report.steps as unknown[]).push({
        kind: "leaderboards",
        league: competition.shortName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const topLeague = enabled[0];
  if (topLeague) {
    try {
      const teamStats = await importTeamSeasonStatisticsFromApiFootball({
        leagueApiId: topLeague.apiId,
        seasonYear,
        maximumTeams: 6,
      });
      (report.steps as unknown[]).push({ kind: "teamStatistics", ...teamStats });
    } catch (error) {
      (report.steps as unknown[]).push({
        kind: "teamStatistics",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const events = await importMatchEventsFromApiFootball({
      seasonYear,
      maximumMatches: 12,
    });
    (report.steps as unknown[]).push({ kind: "events", ...events });
  } catch (error) {
    (report.steps as unknown[]).push({
      kind: "events",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const venuesFilled = await prisma.team.count({
    where: {
      venueApiId: { not: null },
      venueName: { not: null },
      venueCity: { not: null },
    },
  });
  (report.steps as unknown[]).push({
    kind: "venues",
    note: "Venue fields come from /teams responses (already imported); dedicated /venues backfill optional.",
    teamsWithVenue: venuesFilled,
  });

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
