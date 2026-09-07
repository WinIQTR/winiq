import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  prisma,
} from "@/lib/prisma";

import type {
  PlayerPosition,
} from "@/generated/prisma/enums";

type ApiFootballPlayerResponse = {
  player: {
    id: number;
    name: string;

    firstname?: string | null;
    lastname?: string | null;

    age?: number | null;

    birth?: {
      date?: string | null;
      place?: string | null;
      country?: string | null;
    } | null;

    nationality?: string | null;

    height?: string | null;
    weight?: string | null;

    injured?: boolean | null;

    photo?: string | null;
  };

  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo?: string | null;
    };

    league: {
      id: number;
      name: string;
      country?: string | null;
      logo?: string | null;
      flag?: string | null;
      season: number;
    };

    games: {
  appearances?: number | null;
  appearences?: number | null;
      lineups?: number | null;
      minutes?: number | null;

      number?: number | null;

      position?: string | null;

      rating?:
        | string
        | number
        | null;

      captain?: boolean | null;
    };

    substitutes?: {
      in?: number | null;
      out?: number | null;
      bench?: number | null;
    };

    shots?: {
      total?: number | null;
      on?: number | null;
    };

    goals?: {
      total?: number | null;
      conceded?: number | null;
      assists?: number | null;
      saves?: number | null;
    };

    passes?: {
      total?: number | null;
      key?: number | null;

      accuracy?:
        | number
        | string
        | null;
    };

    tackles?: {
      total?: number | null;
      blocks?: number | null;
      interceptions?: number | null;
    };

    duels?: {
      total?: number | null;
      won?: number | null;
    };

    dribbles?: {
      attempts?: number | null;
      success?: number | null;
      past?: number | null;
    };

    fouls?: {
      drawn?: number | null;
      committed?: number | null;
    };

    cards?: {
      yellow?: number | null;
      yellowred?: number | null;
      red?: number | null;
    };

    penalty?: {
      won?: number | null;
      committed?: number | null;
      scored?: number | null;
      missed?: number | null;
      saved?: number | null;
    };
  }>;
};

export type ImportPlayersResult = {
  league: {
    id: number;
    apiId: number;
    name: string;
  };

  season: number;

  teamsProcessed: number;
  apiRequests: number;

  playerRowsReceived: number;

  uniquePlayers: number;

  playersCreated: number;
  playersUpdated: number;

  statisticsCreated: number;
  statisticsUpdated: number;

  skippedStatistics: number;

  teamsReachedPageLimit: string[];
};

const PLAYER_MAX_PAGE = Math.max(
  3,
  Number.parseInt(process.env.API_FOOTBALL_PLAYER_MAX_PAGE ?? "100", 10) || 100,
);

function parseMeasurement(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /(\d+(?:\.\d+)?)/,
    );

  if (!match) {
    return null;
  }

  const parsed =
    Number(match[1]);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return null;
  }

  return Math.round(
    parsed,
  );
}

function parseNumber(
  value:
    | number
    | string
    | null
    | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function parseInteger(
  value:
    | number
    | string
    | null
    | undefined,
): number {
  const parsed =
    parseNumber(
      value,
    );

  if (
    parsed === null
  ) {
    return 0;
  }

  return Math.round(
    parsed,
  );
}

function parseBirthDate(
  value:
    | string
    | null
    | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

function mapPosition(
  value:
    | string
    | null
    | undefined,
): PlayerPosition {
  const normalized =
    value
      ?.trim()
      .toLowerCase();

  switch (
    normalized
  ) {
    case "goalkeeper":
      return "GOALKEEPER";

    case "defender":
      return "DEFENDER";

    case "midfielder":
      return "MIDFIELDER";

    case "attacker":
    case "forward":
      return "FORWARD";

    default:
      return "UNKNOWN";
  }
}

export async function importPlayersFromApiFootball(
  apiLeagueId: number,
  seasonYear: number,
): Promise<ImportPlayersResult> {
  if (
    !Number.isInteger(
      apiLeagueId,
    ) ||
    apiLeagueId <= 0
  ) {
    throw new Error(
      "Geçerli bir lig API ID değeri girilmelidir.",
    );
  }

  if (
    !Number.isInteger(
      seasonYear,
    ) ||
    seasonYear < 1900
  ) {
    throw new Error(
      "Geçerli bir sezon yılı girilmelidir.",
    );
  }

  const league =
    await prisma.league.findUnique({
      where: {
        apiId:
          apiLeagueId,
      },

      include: {
        seasons: true,
      },
    });

  if (!league) {
    throw new Error(
      `${apiLeagueId} API ID değerine sahip lig veritabanında bulunamadı.`,
    );
  }

  const season =
    league.seasons.find(
      (item) =>
        item.year ===
        seasonYear,
    );

  if (!season) {
    throw new Error(
      `${seasonYear} sezonu ${league.name} için veritabanında bulunamadı.`,
    );
  }

  /*
   * Ligde yer alan takımları mevcut
   * fixture kayıtlarından çıkarıyoruz.
   *
   * Böylece /players?league=39&page=4
   * problemine girmeden takımları
   * tek tek sorgulayacağız.
   */
  const matches =
    await prisma.match.findMany({
      where: {
        seasonId:
          season.id,
      },

      select: {
        homeTeam: {
          select: {
            id: true,
            apiId: true,
            name: true,
          },
        },

        awayTeam: {
          select: {
            id: true,
            apiId: true,
            name: true,
          },
        },
      },
    });

  const teamsById =
    new Map<
      number,
      {
        id: number;
        apiId: number;
        name: string;
      }
    >();

  for (
    const match
    of matches
  ) {
    teamsById.set(
      match.homeTeam.id,
      match.homeTeam,
    );

    teamsById.set(
      match.awayTeam.id,
      match.awayTeam,
    );
  }

  const teams =
    [...teamsById.values()]
      .sort(
        (
          first,
          second,
        ) =>
          first.name.localeCompare(
            second.name,
          ),
      );

  if (
    teams.length === 0
  ) {
    throw new Error(
      `${league.name} ${seasonYear} sezonu için takım bulunamadı.`,
    );
  }

  console.log(
    `Takım sayısı: ${teams.length}`,
  );

  console.log("");

  let apiRequests = 0;

  let playerRowsReceived =
    0;

  let playersCreated = 0;
  let playersUpdated = 0;

  let statisticsCreated =
    0;

  let statisticsUpdated =
    0;

  let skippedStatistics =
    0;

  const uniquePlayerApiIds =
    new Set<number>();

  const teamsReachedPageLimit:
    string[] = [];

  for (
    let teamIndex = 0;
    teamIndex <
    teams.length;
    teamIndex += 1
  ) {
    const team =
      teams[teamIndex];

    console.log(
      `[${teamIndex + 1}/${teams.length}] ${team.name}`,
    );

    let page = 1;

    let totalPages = 1;

    do {
      const data =
        await apiFootballRequest<
          ApiFootballPlayerResponse[]
        >(
          "players",
          {
            league:
              apiLeagueId,

            season:
              seasonYear,

            team:
              team.apiId,

            page,
          },
        );

      apiRequests += 1;

      totalPages =
        Math.max(
          data.paging.total,
          1,
        );

      playerRowsReceived +=
        data.response.length;

      console.log(
        `   Sayfa ${page}/${totalPages} • ${data.response.length} oyuncu`,
      );

      for (
        const source
        of data.response
      ) {
        uniquePlayerApiIds.add(
          source.player.id,
        );

        /*
         * İstenen lig + sezon + takım
         * istatistiğini seçiyoruz.
         */
        const statistic =
          source.statistics.find(
            (item) =>
              item.league.id ===
                apiLeagueId &&
              item.league.season ===
                seasonYear &&
              item.team.id ===
                team.apiId,
          );

        if (!statistic) {
          skippedStatistics +=
            1;

          continue;
        }

        const existingPlayer =
          await prisma.player.findUnique({
            where: {
              apiId:
                source.player.id,
            },

            select: {
              id: true,
            },
          });

        const position =
          mapPosition(
            statistic.games
              .position,
          );

        const player =
          await prisma.player.upsert({
            where: {
              apiId:
                source.player.id,
            },

            update: {
              teamId:
                team.id,

              name:
                source.player.name,

              nationality:
                source.player.nationality ?? undefined,

              firstName:
                source.player
                  .firstname ??
                undefined,

              lastName:
                source.player
                  .lastname ??
                undefined,

              birthDate:
                parseBirthDate(
                  source.player
                    .birth?.date,
                ) ??
                undefined,

              age:
                source.player.age ??
                undefined,

              position,

              detailedPosition:
                statistic.games
                  .position ??
                undefined,

              heightCm:
                parseMeasurement(
                  source.player
                    .height,
                ) ??
                undefined,

              weightKg:
                parseMeasurement(
                  source.player
                    .weight,
                ) ??
                undefined,

              shirtNumber:
                statistic.games
                  .number ??
                undefined,

              photoUrl:
                source.player
                  .photo ??
                undefined,

              isActive:
                true,
            },

            create: {
              apiId:
                source.player.id,

              teamId:
                team.id,

              name:
                source.player.name,

              nationality:
                source.player.nationality ?? undefined,

              firstName:
                source.player
                  .firstname ??
                undefined,

              lastName:
                source.player
                  .lastname ??
                undefined,

              birthDate:
                parseBirthDate(
                  source.player
                    .birth?.date,
                ) ??
                undefined,

              age:
                source.player.age ??
                undefined,

              position,

              detailedPosition:
                statistic.games
                  .position ??
                undefined,

              heightCm:
                parseMeasurement(
                  source.player
                    .height,
                ) ??
                undefined,

              weightKg:
                parseMeasurement(
                  source.player
                    .weight,
                ) ??
                undefined,

              shirtNumber:
                statistic.games
                  .number ??
                undefined,

              photoUrl:
                source.player
                  .photo ??
                undefined,

              isActive:
                true,
            },
          });

        if (
          existingPlayer
        ) {
          playersUpdated +=
            1;
        } else {
          playersCreated +=
            1;
        }

        const existingStatistic =
          await prisma.playerSeasonStatistic.findUnique({
            where: {
              playerId_teamId_seasonId: {
                playerId:
                  player.id,

                teamId:
                  team.id,

                seasonId:
                  season.id,
              },
            },

            select: {
              id: true,
            },
          });

        const averageRating =
          parseNumber(
            statistic.games
              .rating,
          );

        const passAccuracy =
          parseNumber(
            statistic.passes
              ?.accuracy,
          );

        const statisticData = {
          appearances:
  parseInteger(
    statistic.games
      .appearances ??
      statistic.games
        .appearences,
            ),

          starts:
            parseInteger(
              statistic.games
                .lineups,
            ),

          minutes:
            parseInteger(
              statistic.games
                .minutes,
            ),

          goals:
            parseInteger(
              statistic.goals
                ?.total,
            ),

          assists:
            parseInteger(
              statistic.goals
                ?.assists,
            ),

          substituteIn: parseInteger(statistic.substitutes?.in),
          substituteOut: parseInteger(statistic.substitutes?.out),
          substituteBench: parseInteger(statistic.substitutes?.bench),

          shots:
            parseInteger(
              statistic.shots
                ?.total,
            ),

          shotsOnTarget:
            parseInteger(
              statistic.shots
                ?.on,
            ),

          passes: parseInteger(statistic.passes?.total),

          keyPasses:
            parseInteger(
              statistic.passes
                ?.key,
            ),

          successfulDribbles:
            parseInteger(
              statistic.dribbles
                ?.success,
            ),

          dribbleAttempts: parseInteger(statistic.dribbles?.attempts),

          tackles:
            parseInteger(
              statistic.tackles
                ?.total,
            ),

          interceptions:
            parseInteger(
              statistic.tackles
                ?.interceptions,
            ),

          duelsWon:
            parseInteger(
              statistic.duels
                ?.won,
            ),

          duels: parseInteger(statistic.duels?.total),

          passAccuracy,

          foulsDrawn: parseInteger(statistic.fouls?.drawn),
          foulsCommitted: parseInteger(statistic.fouls?.committed),
          goalsConceded: parseInteger(statistic.goals?.conceded),
          saves: parseInteger(statistic.goals?.saves),
          penaltiesWon: parseInteger(statistic.penalty?.won),
          penaltiesCommitted: parseInteger(statistic.penalty?.committed),
          penaltiesScored: parseInteger(statistic.penalty?.scored),
          penaltiesMissed: parseInteger(statistic.penalty?.missed),
          penaltiesSaved: parseInteger(statistic.penalty?.saved),

          yellowCards:
            parseInteger(
              statistic.cards
                ?.yellow,
            ),

          redCards:
            parseInteger(
              statistic.cards
                ?.red,
            ) +
            parseInteger(
              statistic.cards
                ?.yellowred,
            ),

          averageRating,
        };

        await prisma.playerSeasonStatistic.upsert({
          where: {
            playerId_teamId_seasonId: {
              playerId:
                player.id,

              teamId:
                team.id,

              seasonId:
                season.id,
            },
          },

          update:
            statisticData,

          create: {
            playerId:
              player.id,

            teamId:
              team.id,

            seasonId:
              season.id,

            ...statisticData,
          },
        });

        if (
          existingStatistic
        ) {
          statisticsUpdated +=
            1;
        } else {
          statisticsCreated +=
            1;
        }
      }

      /*
       * Takım sorgusunda API bize
       * 3'ten fazla sayfa olduğunu söylerse
       * ücretsiz plan 4. sayfayı reddedeceği
       * için güvenli biçimde duruyoruz.
       */
      if (
        page ===
          PLAYER_MAX_PAGE &&
        totalPages >
          PLAYER_MAX_PAGE
      ) {
        teamsReachedPageLimit.push(
          team.name,
        );

        console.log(
          `   UYARI: ${team.name} ${totalPages} sayfa döndürdü; yapılandırılmış ${PLAYER_MAX_PAGE} sayfa sınırında duruldu.`,
        );

        break;
      }

      page += 1;
    } while (
      page <=
        totalPages &&
      page <=
        PLAYER_MAX_PAGE
    );

    console.log("");
  }

  return {
    league: {
      id:
        league.id,

      apiId:
        league.apiId,

      name:
        league.name,
    },

    season:
      seasonYear,

    teamsProcessed:
      teams.length,

    apiRequests,

    playerRowsReceived,

    uniquePlayers:
      uniquePlayerApiIds.size,

    playersCreated,
    playersUpdated,

    statisticsCreated,
    statisticsUpdated,

    skippedStatistics,

    teamsReachedPageLimit,
  };
}
