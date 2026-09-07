import "dotenv/config";

import {
  importMatchTeamStatistics,
} from "@/modules/importer/football/api-football/import-match-team-statistics";

const LEAGUE_API_ID =
  39;

const SEASON_YEAR =
  2024;

const MAXIMUM_MATCHES =
  10;

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "MATCH TEAM STATISTICS IMPORT",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Lig: Premier League (${LEAGUE_API_ID})`,
  );

  console.log(
    `Sezon: ${SEASON_YEAR}`,
  );

  console.log(
    `Bu çalıştırmada maksimum maç: ${MAXIMUM_MATCHES}`,
  );

  const result =
    await importMatchTeamStatistics({
      leagueApiId:
        LEAGUE_API_ID,

      seasonYear:
        SEASON_YEAR,

      maximumMatches:
        MAXIMUM_MATCHES,
    });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "IMPORT RESULT",
  );

  console.log(
    "========================================",
  );

  console.table({
    "İşlenen maç":
      result.matchesProcessed,

    "Atlanan maç":
      result.matchesSkipped,

    "Takım istatistiği":
      result.teamStatisticsSaved,

    "API isteği":
      result.apiRequests,

    "Kalan maç":
      result.remainingMatches,

    "Günlük limit":
      result.stoppedByDailyLimit
        ? "EVET"
        : "HAYIR",

    "Rate limit":
      result.stoppedByRateLimit
        ? "EVET"
        : "HAYIR",
  });
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error(
        error instanceof Error
          ? error.message
          : error,
      );

      process.exitCode =
        1;
    },
  );