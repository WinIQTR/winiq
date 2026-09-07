import "dotenv/config";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  prisma,
} from "@/lib/prisma";

async function main():
  Promise<void> {
  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "SEASON + HISTORICAL COVERAGE CHECK",
  );

  console.log(
    "==============================================",
  );

  const rows:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const competition
    of ACTIVE_COMPETITIONS
  ) {
    const seasons =
      await prisma
        .season
        .findMany({
          where: {
            league: {
              apiId:
                competition.apiId,
            },
          },

          orderBy: {
            year:
              "desc",
          },

          select: {
            id:
              true,

            year:
              true,

            isCurrent:
              true,

            _count: {
              select: {
                matches:
                  true,
              },
            },
          },
        });

    for (
      const season
      of seasons
    ) {
      const finished =
        await prisma
          .match
          .count({
            where: {
              seasonId:
                season.id,

              status:
                "FINISHED",

              homeScore: {
                not:
                  null,
              },

              awayScore: {
                not:
                  null,
              },
            },
          });

      const earliestMatch =
        await prisma
          .match
          .findFirst({
            where: {
              seasonId:
                season.id,
            },

            orderBy: {
              kickoffAt:
                "asc",
            },

            select: {
              kickoffAt:
                true,
            },
          });

      const latestMatch =
        await prisma
          .match
          .findFirst({
            where: {
              seasonId:
                season.id,
            },

            orderBy: {
              kickoffAt:
                "desc",
            },

            select: {
              kickoffAt:
                true,
            },
          });

      rows.push({
        apiId:
          competition.apiId,

        league:
          competition.name,

        seasonId:
          season.id,

        year:
          season.year,

        current:
          season.isCurrent,

        matches:
          season
            ._count
            .matches,

        finished,

        earliest:
          earliestMatch
            ?.kickoffAt
            .toISOString()
            .slice(
              0,
              10,
            ) ??
          "-",

        latest:
          latestMatch
            ?.kickoffAt
            .toISOString()
            .slice(
              0,
              10,
            ) ??
          "-",
      });
    }
  }

  console.log("");
  console.log(
    "SEASON COVERAGE",
  );

  console.table(
    rows,
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "LEAGUE SUMMARY",
  );

  console.log(
    "==============================================",
  );

  console.table(
    ACTIVE_COMPETITIONS.map(
      (
        competition,
      ) => {
        const competitionRows =
          rows.filter(
            (
              row,
            ) =>
              row.apiId ===
              competition.apiId,
          );

        const finished =
          competitionRows.reduce(
            (
              total,
              row,
            ) =>
              total +
              Number(
                row.finished ??
                0,
              ),
            0,
          );

        return {
          apiId:
            competition.apiId,

          league:
            competition.name,

          seasons:
            competitionRows.length,

          years:
            competitionRows
              .map(
                (
                  row,
                ) =>
                  row.year,
              )
              .join(
                ", ",
              ),

          totalFinished:
            finished,
        };
      },
    ),
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "SEASON COVERAGE CHECK TAMAMLANDI",
  );

  console.log(
    "==============================================",
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");

      console.error(
        "Season coverage kontrolü başarısız.",
      );

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