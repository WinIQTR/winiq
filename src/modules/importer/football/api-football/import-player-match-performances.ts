import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  prisma,
} from "@/lib/prisma";

type ApiFootballFixturePlayer = {
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };

  players: Array<{
    player: {
      id: number;
      name: string;
      photo?: string | null;
    };

    statistics: Array<{
      games?: {
        minutes?: number | null;
        number?: number | null;
        position?: string | null;
        rating?: string | null;
        captain?: boolean | null;
        substitute?: boolean | null;
      };

      shots?: {
        total?: number | null;
        on?: number | null;
      };

      goals?: {
        total?: number | null;
        assists?: number | null;
        saves?: number | null;
      };

      passes?: {
        total?: number | null;
        key?: number | null;
        accuracy?: string | null;
      };

      tackles?: {
        total?: number | null;
        interceptions?: number | null;
      };

      duels?: {
        total?: number | null;
        won?: number | null;
      };

      dribbles?: {
        attempts?: number | null;
        success?: number | null;
      };

      cards?: {
        yellow?: number | null;
        red?: number | null;
      };
    }>;
  }>;
};

export type ImportPlayerMatchPerformancesResult = {
  matchesProcessed: number;
  matchesSkipped: number;

  playersReceived: number;
  performancesSaved: number;
  playersNotFound: number;

  apiRequests: number;

  remainingMatches: number;

  stoppedByDailyLimit: boolean;
  stoppedByRateLimit: boolean;
};

type ImportOptions = {
  leagueApiId: number;
  seasonYear: number;

  maximumMatches?: number;

  requestDelayMs?: number;
};

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function parseRating(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const parsed =
    Number.parseFloat(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return null;
  }

  return parsed;
}

function parsePercentage(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const cleaned =
    value
      .replace(
        "%",
        "",
      )
      .trim();

  const parsed =
    Number.parseFloat(
      cleaned,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return null;
  }

  return parsed;
}

function safeInteger(
  value: number | null | undefined,
): number {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      value,
    ),
  );
}

function isDailyLimitMessage(
  message: string,
): boolean {
  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "request limit for the day",
    ) ||
    normalized.includes(
      "reached the request limit",
    ) ||
    normalized.includes(
      "daily request limit",
    ) ||
    normalized.includes(
      "limit for the day",
    )
  );
}

function isRateLimitMessage(
  message: string,
): boolean {
  const normalized =
    message.toLowerCase();

  return (
    message.includes(
      "429",
    ) ||
    normalized.includes(
      "too many requests",
    ) ||
    normalized.includes(
      "rate limit",
    )
  );
}

export async function importPlayerMatchPerformances(
  options: ImportOptions,
): Promise<ImportPlayerMatchPerformancesResult> {
  const {
    leagueApiId,
    seasonYear,
    maximumMatches = 20,
    requestDelayMs = 1500,
  } = options;

  if (
    !Number.isInteger(
      leagueApiId,
    ) ||
    leagueApiId <= 0
  ) {
    throw new Error(
      "leagueApiId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      seasonYear,
    ) ||
    seasonYear <= 0
  ) {
    throw new Error(
      "seasonYear geçerli bir yıl olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      maximumMatches,
    ) ||
    maximumMatches <= 0
  ) {
    throw new Error(
      "maximumMatches pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isFinite(
      requestDelayMs,
    ) ||
    requestDelayMs < 0
  ) {
    throw new Error(
      "requestDelayMs sıfır veya pozitif olmalıdır.",
    );
  }

  const season =
    await prisma.season.findFirst({
      where: {
        year:
          seasonYear,

        league: {
          apiId:
            leagueApiId,
        },
      },

      include: {
        league:
          true,
      },
    });

  if (!season) {
    throw new Error(
      `${leagueApiId} lig ID ve ${seasonYear} sezonu veritabanında bulunamadı.`,
    );
  }

  const finishedMatches =
    await prisma.match.findMany({
      where: {
        seasonId:
          season.id,

        status:
          "FINISHED",
      },

      select: {
        id: true,
        apiId: true,
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

        playerPerformances: {
          select: {
            id: true,
          },

          take:
            1,
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  const matchesWithoutPerformance =
    finishedMatches.filter(
      (match) =>
        match.playerPerformances.length ===
        0,
    );

  const matchesToProcess =
    matchesWithoutPerformance.slice(
      0,
      maximumMatches,
    );

  let matchesProcessed =
    0;

  let matchesSkipped =
    0;

  let playersReceived =
    0;

  let performancesSaved =
    0;

  let playersNotFound =
    0;

  let apiRequests =
    0;

  let stoppedByDailyLimit =
    false;

  let stoppedByRateLimit =
    false;

  for (
    let matchIndex = 0;
    matchIndex <
    matchesToProcess.length;
    matchIndex += 1
  ) {
    const match =
      matchesToProcess[
        matchIndex
      ];

    console.log("");

    console.log(
      `[${matchIndex + 1}/${matchesToProcess.length}] ${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    try {
      /*
       * Bu noktada API isteği yapmayı
       * deniyoruz; başarılı veya hatalı
       * yanıt fark etmeksizin bu bir request
       * denemesidir.
       */
      apiRequests += 1;

      const response =
        await apiFootballRequest<
          ApiFootballFixturePlayer[]
        >(
          "fixtures/players",
          {
            fixture:
              match.apiId,
          },
        );

      if (
        !response.response ||
        response.response.length ===
          0
      ) {
        console.log(
          "  Oyuncu performans verisi bulunamadı.",
        );

        matchesSkipped +=
          1;

        if (
          matchIndex <
          matchesToProcess.length -
            1
        ) {
          await sleep(
            requestDelayMs,
          );
        }

        continue;
      }

      let matchSavedCount =
        0;

      for (
        const teamData
        of response.response
      ) {
        const databaseTeam =
          await prisma.team.findUnique({
            where: {
              apiId:
                teamData.team.id,
            },

            select: {
              id:
                true,
            },
          });

        if (
          !databaseTeam
        ) {
          console.log(
            `  Takım bulunamadı: ${teamData.team.name}`,
          );

          continue;
        }

        for (
          const sourcePlayer
          of teamData.players
        ) {
          playersReceived +=
            1;

          const databasePlayer =
            await prisma.player.findUnique({
              where: {
                apiId:
                  sourcePlayer.player.id,
              },

              select: {
                id:
                  true,
              },
            });

          if (
            !databasePlayer
          ) {
            playersNotFound +=
              1;

            console.log(
              `  Oyuncu bulunamadı: ${sourcePlayer.player.name} (${sourcePlayer.player.id})`,
            );

            continue;
          }

          const statistics =
            sourcePlayer.statistics[
              0
            ];

          if (
            !statistics
          ) {
            continue;
          }

          const minutes =
            safeInteger(
              statistics.games
                ?.minutes,
            );

          const rating =
            parseRating(
              statistics.games
                ?.rating,
            );

          const substitute =
            statistics.games
              ?.substitute ??
            false;

          const starter =
            !substitute &&
            minutes > 0;

          await prisma.playerMatchPerformance.upsert({
            where: {
              playerId_matchId: {
                playerId:
                  databasePlayer.id,

                matchId:
                  match.id,
              },
            },

            update: {
              teamId:
                databaseTeam.id,

              seasonId:
                season.id,

              starter,

              captain:
                statistics.games
                  ?.captain ??
                false,

              position:
                statistics.games
                  ?.position ??
                null,

              shirtNumber:
                statistics.games
                  ?.number ??
                null,

              minutes,

              rating,

              goals:
                safeInteger(
                  statistics.goals
                    ?.total,
                ),

              assists:
                safeInteger(
                  statistics.goals
                    ?.assists,
                ),

              shots:
                safeInteger(
                  statistics.shots
                    ?.total,
                ),

              shotsOnTarget:
                safeInteger(
                  statistics.shots
                    ?.on,
                ),

              passes:
                safeInteger(
                  statistics.passes
                    ?.total,
                ),

              keyPasses:
                safeInteger(
                  statistics.passes
                    ?.key,
                ),

              passAccuracy:
                parsePercentage(
                  statistics.passes
                    ?.accuracy,
                ),

              tackles:
                safeInteger(
                  statistics.tackles
                    ?.total,
                ),

              interceptions:
                safeInteger(
                  statistics.tackles
                    ?.interceptions,
                ),

              duels:
                safeInteger(
                  statistics.duels
                    ?.total,
                ),

              duelsWon:
                safeInteger(
                  statistics.duels
                    ?.won,
                ),

              dribbles:
                safeInteger(
                  statistics.dribbles
                    ?.attempts,
                ),

              dribblesWon:
                safeInteger(
                  statistics.dribbles
                    ?.success,
                ),

              saves:
                safeInteger(
                  statistics.goals
                    ?.saves,
                ),

              yellowCards:
                safeInteger(
                  statistics.cards
                    ?.yellow,
                ),

              redCards:
                safeInteger(
                  statistics.cards
                    ?.red,
                ),

              source:
                "API_FOOTBALL",
            },

            create: {
              playerId:
                databasePlayer.id,

              matchId:
                match.id,

              teamId:
                databaseTeam.id,

              seasonId:
                season.id,

              starter,

              captain:
                statistics.games
                  ?.captain ??
                false,

              position:
                statistics.games
                  ?.position ??
                null,

              shirtNumber:
                statistics.games
                  ?.number ??
                null,

              minutes,

              rating,

              goals:
                safeInteger(
                  statistics.goals
                    ?.total,
                ),

              assists:
                safeInteger(
                  statistics.goals
                    ?.assists,
                ),

              shots:
                safeInteger(
                  statistics.shots
                    ?.total,
                ),

              shotsOnTarget:
                safeInteger(
                  statistics.shots
                    ?.on,
                ),

              passes:
                safeInteger(
                  statistics.passes
                    ?.total,
                ),

              keyPasses:
                safeInteger(
                  statistics.passes
                    ?.key,
                ),

              passAccuracy:
                parsePercentage(
                  statistics.passes
                    ?.accuracy,
                ),

              tackles:
                safeInteger(
                  statistics.tackles
                    ?.total,
                ),

              interceptions:
                safeInteger(
                  statistics.tackles
                    ?.interceptions,
                ),

              duels:
                safeInteger(
                  statistics.duels
                    ?.total,
                ),

              duelsWon:
                safeInteger(
                  statistics.duels
                    ?.won,
                ),

              dribbles:
                safeInteger(
                  statistics.dribbles
                    ?.attempts,
                ),

              dribblesWon:
                safeInteger(
                  statistics.dribbles
                    ?.success,
                ),

              saves:
                safeInteger(
                  statistics.goals
                    ?.saves,
                ),

              yellowCards:
                safeInteger(
                  statistics.cards
                    ?.yellow,
                ),

              redCards:
                safeInteger(
                  statistics.cards
                    ?.red,
                ),

              source:
                "API_FOOTBALL",
            },
          });

          performancesSaved +=
            1;

          matchSavedCount +=
            1;
        }
      }

      if (
        matchSavedCount >
        0
      ) {
        matchesProcessed +=
          1;

        console.log(
          `  ${matchSavedCount} oyuncu performansı kaydedildi.`,
        );
      } else {
        matchesSkipped +=
          1;

        console.log(
          "  Kaydedilebilecek performans bulunamadı.",
        );
      }
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      console.error(
        `  Maç işlenemedi: ${message}`,
      );

      if (
        isDailyLimitMessage(
          message,
        )
      ) {
        stoppedByDailyLimit =
          true;

        console.log("");

        console.log(
          "API-Football günlük istek limiti doldu.",
        );

        console.log(
          "Kalan maçlara API isteği gönderilmeyecek.",
        );

        console.log(
          "Script güvenli şekilde durduruluyor.",
        );

        console.log(
          "Limit yenilendiğinde tekrar çalıştırıldığında eksik maçlardan devam edecek.",
        );

        break;
      }

      if (
        isRateLimitMessage(
          message,
        )
      ) {
        stoppedByRateLimit =
          true;

        console.log("");

        console.log(
          "API-Football rate limit tespit edildi.",
        );

        console.log(
          "Kalan maçlara API isteği gönderilmeyecek.",
        );

        console.log(
          "Script güvenli şekilde durduruluyor.",
        );

        break;
      }

      matchesSkipped +=
        1;
    }

    if (
      matchIndex <
      matchesToProcess.length -
        1
    ) {
      await sleep(
        requestDelayMs,
      );
    }
  }

  const processedMatchIds =
    await prisma.playerMatchPerformance.findMany({
      where: {
        seasonId:
          season.id,
      },

      distinct: [
        "matchId",
      ],

      select: {
        matchId:
          true,
      },
    });

  const remainingMatches =
    Math.max(
      finishedMatches.length -
        processedMatchIds.length,
      0,
    );

  return {
    matchesProcessed,
    matchesSkipped,

    playersReceived,
    performancesSaved,
    playersNotFound,

    apiRequests,

    remainingMatches,

    stoppedByDailyLimit,
    stoppedByRateLimit,
  };
}