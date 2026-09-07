import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

const SEASON_YEAR =
  Number(
    process.env.API_FOOTBALL_SEASON ??
      "2026",
  );

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "TARGET COMPETITIONS DATABASE AUDIT",
  );

  console.log(
    "========================================",
  );

  console.log("");
  console.log(
    `Kontrol sezonu: ${SEASON_YEAR}`,
  );

  const rows = [];

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    const league =
      await prisma.league.findUnique({
        where: {
          apiId:
            competition.apiId,
        },

        select: {
          id: true,
          name: true,

          seasons: {
            where: {
              year:
                SEASON_YEAR,
            },

            select: {
              id: true,
              year: true,
              isCurrent: true,

              _count: {
                select: {
                  matches: true,
                  teamSeasons: true,
                },
              },
            },
          },
        },
      });

    const season =
      league?.seasons[0];

    rows.push({
      priority:
        competition.priority,

      apiId:
        competition.apiId,

      competition:
        competition.name,

      leagueDB:
        league
          ? "EVET"
          : "HAYIR",

      seasonDB:
        season
          ? "EVET"
          : "HAYIR",

      teams:
        season?._count
          .teamSeasons ??
        0,

      matches:
        season?._count
          .matches ??
        0,

      current:
        season?.isCurrent
          ? "EVET"
          : "HAYIR",
    });
  }

  console.table(
    rows,
  );

  const ready =
    rows.filter(
      (row) =>
        row.leagueDB ===
          "EVET" &&
        row.seasonDB ===
          "EVET",
    ).length;

  console.log("");

  console.table({
    "Organizasyon":
      ACTIVE_COMPETITIONS.length,

    "League hazır":
      rows.filter(
        (row) =>
          row.leagueDB ===
          "EVET",
      ).length,

    "Season hazır":
      rows.filter(
        (row) =>
          row.seasonDB ===
          "EVET",
      ).length,

    "Fixture import hazır":
      ready,

    "Eksik":
      ACTIVE_COMPETITIONS.length -
      ready,
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