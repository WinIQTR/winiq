import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  prisma,
} from "@/lib/prisma";

type ApiLineupPlayer = {
  player: {
    id: number;
    name: string;
    number?: number | null;
    pos?: string | null;
    grid?: string | null;
  };
};

type ApiLineupResponse = {
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };

  formation?: string | null;

  startXI?: ApiLineupPlayer[];
  substitutes?: ApiLineupPlayer[];
};

export type ImportMatchLineupsResult = {
  matchId: number;

  fixtureApiId: number;

  teamsReceived: number;

  lineupsSaved: number;

  playersSaved: number;

  startersSaved: number;

  substitutesSaved: number;

  playersCreated: number;

  playersUpdated: number;
};

function mapPosition(
  position:
    | string
    | null
    | undefined,
): "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" | "UNKNOWN" {
  switch (
    position
      ?.trim()
      .toUpperCase()
  ) {
    case "G":
      return "GOALKEEPER";

    case "D":
      return "DEFENDER";

    case "M":
      return "MIDFIELDER";

    case "F":
      return "FORWARD";

    default:
      return "UNKNOWN";
  }
}

export async function importMatchLineupsFromApiFootball(
  matchId: number,
): Promise<ImportMatchLineupsResult> {
  if (
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id: matchId,
      },

      select: {
        id: true,
        apiId: true,

        homeTeamId: true,
        awayTeamId: true,
      },
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  const response =
    await apiFootballRequest<
      ApiLineupResponse[]
    >(
      "fixtures/lineups",
      {
        fixture:
          match.apiId,
      },
    );

  let lineupsSaved = 0;

  let playersSaved = 0;
  let startersSaved = 0;
  let substitutesSaved = 0;

  let playersCreated = 0;
  let playersUpdated = 0;

  for (
    const source
    of response.response
  ) {
    const databaseTeam =
      await prisma.team.findUnique({
        where: {
          apiId:
            source.team.id,
        },

        select: {
          id: true,
        },
      });

    if (!databaseTeam) {
      console.warn(
        `Takım DB'de bulunamadı: ${source.team.name} (${source.team.id})`,
      );

      continue;
    }

    /*
     * Confirmed lineup.
     *
     * Aynı maç + takım + status için
     * tek kayıt tutulur.
     */
    const lineup =
      await prisma.lineup.upsert({
        where: {
          matchId_teamId_status: {
            matchId:
              match.id,

            teamId:
              databaseTeam.id,

            status:
              "CONFIRMED",
          },
        },

        update: {
          formation:
            source.formation ??
            null,

          isConfirmed:
            true,

          confirmedAt:
            new Date(),
        },

        create: {
          matchId:
            match.id,

          teamId:
            databaseTeam.id,

          formation:
            source.formation ??
            null,

          status:
            "CONFIRMED",

          isConfirmed:
            true,

          confirmedAt:
            new Date(),
        },
      });

    lineupsSaved += 1;

    /*
     * Bu lineup yeniden import edilirse
     * eski player ilişkilerini temizliyoruz.
     * Böylece stale lineup kalmaz.
     */
    await prisma.lineupPlayer.deleteMany({
      where: {
        lineupId:
          lineup.id,
      },
    });

    const startXI =
      source.startXI ??
      [];

    const substitutes =
      source.substitutes ??
      [];

    const allPlayers = [
      ...startXI.map(
        (item) => ({
          ...item,
          starter: true,
        }),
      ),

      ...substitutes.map(
        (item) => ({
          ...item,
          starter: false,
        }),
      ),
    ];

    for (
      const sourcePlayer
      of allPlayers
    ) {
      const existingPlayer =
        await prisma.player.findUnique({
          where: {
            apiId:
              sourcePlayer.player.id,
          },

          select: {
            id: true,
          },
        });

      const mappedPosition =
        mapPosition(
          sourcePlayer.player.pos,
        );

      const player =
        await prisma.player.upsert({
          where: {
            apiId:
              sourcePlayer.player.id,
          },

          update: {
            teamId:
              databaseTeam.id,

            name:
              sourcePlayer.player.name,

            position:
              mappedPosition,

            detailedPosition:
              sourcePlayer.player.pos ??
              undefined,

            shirtNumber:
              sourcePlayer.player.number ??
              undefined,

            isActive:
              true,
          },

          create: {
            apiId:
              sourcePlayer.player.id,

            teamId:
              databaseTeam.id,

            name:
              sourcePlayer.player.name,

            position:
              mappedPosition,

            detailedPosition:
              sourcePlayer.player.pos ??
              undefined,

            shirtNumber:
              sourcePlayer.player.number ??
              undefined,

            isActive:
              true,
          },
        });

      if (
        existingPlayer
      ) {
        playersUpdated += 1;
      } else {
        playersCreated += 1;
      }

      await prisma.lineupPlayer.create({
        data: {
          lineupId:
            lineup.id,

          playerId:
            player.id,

          teamId:
            databaseTeam.id,

          starter:
            sourcePlayer.starter,

          position:
            sourcePlayer.player.pos ??
            null,

          formationPosition:
            sourcePlayer.player.grid ??
            null,

          shirtNumber:
            sourcePlayer.player.number ??
            null,

          captain:
            false,
        },
      });

      playersSaved += 1;

      if (
        sourcePlayer.starter
      ) {
        startersSaved += 1;
      } else {
        substitutesSaved += 1;
      }
    }
  }

  return {
    matchId:
      match.id,

    fixtureApiId:
      match.apiId,

    teamsReceived:
      response.response.length,

    lineupsSaved,

    playersSaved,

    startersSaved,

    substitutesSaved,

    playersCreated,

    playersUpdated,
  };
}