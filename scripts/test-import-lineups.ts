import {
  prisma,
} from "@/lib/prisma";

import {
  importMatchLineupsFromApiFootball,
} from "@/modules/importer/football/api-football/import-lineups";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "========================================",
  );

  console.log(
    "LINEUP IMPORT TEST",
  );

  console.log(
    "========================================",
  );

  /*
   * Player performance verisi olan
   * en ileri tarihli maçı seçiyoruz.
   */
  const match =
    await prisma.match.findFirst({
      where: {
        status:
          "FINISHED",

        season: {
          year:
            2024,

          league: {
            apiId:
              39,
          },
        },

        playerPerformances: {
          some: {},
        },
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeam: {
          select: {
            name: true,
          },
        },

        awayTeam: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },
    });

  if (!match) {
    console.log(
      "Uygun maç bulunamadı.",
    );

    return;
  }

  console.log("");
  console.log(
    `Maç: ${match.homeTeam.name} - ${match.awayTeam.name}`,
  );

  console.log(
    `Tarih: ${match.kickoffAt.toISOString()}`,
  );

  console.log("");

  const result =
    await importMatchLineupsFromApiFootball(
      match.id,
    );

  console.log(
    "IMPORT RESULT",
  );

  console.table({
    "API takım":
      result.teamsReceived,

    "Lineup kayıt":
      result.lineupsSaved,

    "Oyuncu kayıt":
      result.playersSaved,

    "İlk 11":
      result.startersSaved,

    Yedek:
      result.substitutesSaved,

    "Yeni oyuncu":
      result.playersCreated,

    "Güncellenen oyuncu":
      result.playersUpdated,
  });

  console.log("");

  const lineups =
    await prisma.lineup.findMany({
      where: {
        matchId:
          match.id,

        status:
          "CONFIRMED",
      },

      select: {
        formation: true,

        team: {
          select: {
            name: true,
          },
        },

        players: {
          select: {
            starter: true,
            position: true,
            formationPosition: true,
            shirtNumber: true,

            player: {
              select: {
                name: true,
              },
            },
          },

          orderBy: [
            {
              starter:
                "desc",
            },

            {
              shirtNumber:
                "asc",
            },
          ],
        },
      },
    });

  for (
    const lineup
    of lineups
  ) {
    console.log("");
    console.log(
      "========================================",
    );

    console.log(
      `${lineup.team.name} • ${lineup.formation ?? "FORMATION YOK"}`,
    );

    console.log(
      "========================================",
    );

    console.table(
      lineup.players.map(
        (item) => ({
          oyuncu:
            item.player.name,

          ilk11:
            item.starter
              ? "EVET"
              : "HAYIR",

          pozisyon:
            item.position,

          grid:
            item.formationPosition,

          no:
            item.shirtNumber,
        }),
      ),
    );
  }
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

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );