import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

const DEFAULT_SEASON_YEAR =
  2024;

function getSeasonYear(): number {
  const raw =
    process.env
      .API_FOOTBALL_SEASON
      ?.trim();

  if (!raw) {
    return DEFAULT_SEASON_YEAR;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2100
  ) {
    throw new Error(
      "API_FOOTBALL_SEASON geçerli bir sezon yılı olmalıdır.",
    );
  }

  return parsed;
}

async function main(): Promise<void> {
  const seasonYear =
    getSeasonYear();

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "V1 DATA COVERAGE AUDIT",
  );

  console.log(
    "========================================",
  );

  console.log("");
  console.log(
    `Sezon: ${seasonYear}`,
  );

  const rows = [];

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    const matches =
      await prisma.match.findMany({
        where: {
          status:
            "FINISHED",

          season: {
            year:
              seasonYear,

            league: {
              apiId:
                competition.apiId,
            },
          },
        },

        select: {
          id: true,

          _count: {
            select: {
              playerPerformances:
                true,

              lineups:
                true,

              teamStatistics:
                true,

              playerImpactScores:
                true,

              squadStrengthScores:
                true,

              featureValues:
                true,
            },
          },
        },
      });

    const totalMatches =
      matches.length;

    const performanceMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .playerPerformances >
          0,
      ).length;

    const lineupMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .lineups >=
          2,
      ).length;

    const statisticsMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .teamStatistics >=
          2,
      ).length;

    const impactMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .playerImpactScores >
          0,
      ).length;

    const squadMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .squadStrengthScores >=
          2,
      ).length;

    const snapshotMatches =
      matches.filter(
        (match) =>
          match
            ._count
            .featureValues >
          0,
      ).length;

    const fullyEnriched =
      matches.filter(
        (match) =>
          match
            ._count
            .playerPerformances >
            0 &&
          match
            ._count
            .lineups >=
            2 &&
          match
            ._count
            .teamStatistics >=
            2,
      ).length;

    rows.push({
      apiId:
        competition.apiId,

      competition:
        competition.name,

      matches:
        totalMatches,

      performance:
        performanceMatches,

      lineups:
        lineupMatches,

      statistics:
        statisticsMatches,

      impact:
        impactMatches,

      squad:
        squadMatches,

      snapshots:
        snapshotMatches,

      enriched:
        fullyEnriched,
    });
  }

  console.log("");

  console.table(
    rows,
  );

  const totals =
    rows.reduce(
      (
        result,
        row,
      ) => ({
        matches:
          result.matches +
          row.matches,

        performance:
          result.performance +
          row.performance,

        lineups:
          result.lineups +
          row.lineups,

        statistics:
          result.statistics +
          row.statistics,

        impact:
          result.impact +
          row.impact,

        squad:
          result.squad +
          row.squad,

        snapshots:
          result.snapshots +
          row.snapshots,

        enriched:
          result.enriched +
          row.enriched,
      }),
      {
        matches:
          0,

        performance:
          0,

        lineups:
          0,

        statistics:
          0,

        impact:
          0,

        squad:
          0,

        snapshots:
          0,

        enriched:
          0,
      },
    );

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TOTAL COVERAGE",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.table({
    "Finished matches":
      totals.matches,

    "Player performance":
      totals.performance,

    "Lineups":
      totals.lineups,

    "Team statistics":
      totals.statistics,

    "Player impact":
      totals.impact,

    "Squad strength":
      totals.squad,

    "Feature snapshot":
      totals.snapshots,

    "Fully enriched":
      totals.enriched,
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
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );