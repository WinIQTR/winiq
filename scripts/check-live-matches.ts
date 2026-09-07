import "dotenv/config";

import {
  prisma,
} from "@/lib/prisma";

async function main(): Promise<void> {
  const now =
    new Date();

  const matches =
    await prisma.match.findMany({
      where: {
        status:
          "SCHEDULED",

        kickoffAt: {
          gte:
            now,
        },
      },

      select: {
        id:
          true,

        kickoffAt:
          true,

        status:
          true,

        season: {
          select: {
            year:
              true,

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
            name:
              true,
          },
        },

        awayTeam: {
          select: {
            name:
              true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },

      take:
        50,
    });

  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "LIVE MATCH CHECK",
  );

  console.log(
    "========================================",
  );

  console.log("");

  console.log(
    `Şimdi: ${now.toISOString()}`,
  );

  console.log(
    `Bulunan yaklaşan maç: ${matches.length}`,
  );

  console.log("");

  console.table(
    matches.map(
      (
        match,
      ) => ({
        id:
          match.id,

        sezon:
          match.season.year,

        lig:
          match.season.league.name,

        ligApiId:
          match.season.league.apiId,

        tarih:
          match.kickoffAt.toISOString(),

        ev:
          match.homeTeam.name,

        deplasman:
          match.awayTeam.name,

        durum:
          match.status,
      }),
    ),
  );
}

main()
  .catch(
    (
      error: unknown,
    ) => {
      console.error("");

      console.error(
        "Live match kontrolü başarısız.",
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