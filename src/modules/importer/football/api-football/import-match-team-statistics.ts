import {
  apiFootballRequest,
} from "@/lib/api-football/client";

import {
  prisma,
} from "@/lib/prisma";

type ApiFootballStatistic = {
  type: string;
  value:
    | number
    | string
    | null;
};

type ApiFootballFixtureStatisticsTeam = {
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };

  statistics:
    ApiFootballStatistic[];
};

export type ImportMatchTeamStatisticsResult = {
  candidateMatches: number;
  matchesProcessed: number;
  matchesSkipped: number;
  matchesUnavailable: number;

  teamStatisticsSaved: number;

  apiRequests: number;

  remainingMatches: number;

  stoppedByDailyLimit: boolean;
  stoppedByRateLimit: boolean;
};

export type ImportMatchTeamStatisticsOptions = {
  leagueApiId: number;
  seasonYear: number;

  maximumMatches?: number;
  from?: Date;
  to?: Date;
  refreshIncomplete?: boolean;
};

function hasRequestedStatistics(
  row: {
    shots: number | null;
    shotsOnTarget: number | null;
    corners: number | null;
    offsides: number | null;
    yellowCards: number | null;
  },
): boolean {
  return (
    row.shots !== null &&
    row.shotsOnTarget !== null &&
    row.corners !== null &&
    row.offsides !== null &&
    row.yellowCards !== null
  );
}

function normalizeType(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
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
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(
      value,
    )
      ? value
      : null;
  }

  const cleaned =
    value
      .replace(
        "%",
        "",
      )
      .trim();

  if (
    cleaned.length === 0
  ) {
    return null;
  }

  const parsed =
    Number.parseFloat(
      cleaned,
    );

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
): number | null {
  const parsed =
    parseNumber(
      value,
    );

  if (
    parsed === null
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      parsed,
    ),
  );
}

function getStatistic(
  statistics:
    ApiFootballStatistic[],
  type: string,
):
  | number
  | string
  | null
  | undefined {
  const normalizedTarget =
    normalizeType(
      type,
    );

  return statistics.find(
    (item) =>
      normalizeType(
        item.type,
      ) ===
      normalizedTarget,
  )?.value;
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
    ) ||
    normalized.includes(
      "request sınırı",
    )
  );
}

export async function importMatchTeamStatistics(
  options:
    ImportMatchTeamStatisticsOptions,
): Promise<ImportMatchTeamStatisticsResult> {
  const {
    leagueApiId,
    seasonYear,
    maximumMatches = 10,
    from,
    to,
    refreshIncomplete = false,
  } = options;

  if (from && Number.isNaN(from.getTime())) {
    throw new Error("from geçerli bir tarih olmalıdır.");
  }

  if (to && Number.isNaN(to.getTime())) {
    throw new Error("to geçerli bir tarih olmalıdır.");
  }

  if (from && to && from > to) {
    throw new Error("from tarihi to tarihinden sonra olamaz.");
  }

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

      select: {
        id: true,
      },
    });

  if (!season) {
    throw new Error(
      `${leagueApiId} lig ID ve ${seasonYear} sezonu bulunamadı.`,
    );
  }

  /*
   * Yalnızca bitmiş maçları alıyoruz.
   *
   * İki takım için de MatchTeamStatistic
   * mevcutsa yeniden API çağrısı yapmıyoruz.
   */
  const matches =
    await prisma.match.findMany({
      where: {
        seasonId:
          season.id,

        status:
          "FINISHED",

        ...(from || to
          ? {
              kickoffAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },

      select: {
        id: true,
        apiId: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

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

        teamStatistics: {
          select: {
            teamId: true,
            shots: true,
            shotsOnTarget: true,
            corners: true,
            offsides: true,
            yellowCards: true,
          },
        },
      },

      orderBy: {
        kickoffAt:
          "asc",
      },
    });

  const pendingMatches =
    matches.filter(
      (match) => {
        const completeTeamIds = new Set(
          match.teamStatistics
            .filter((item) => !refreshIncomplete || hasRequestedStatistics(item))
            .map((item) => item.teamId),
        );

        return !(
          completeTeamIds.has(
            match.homeTeamId,
          ) &&
          completeTeamIds.has(
            match.awayTeamId,
          )
        );
      },
    );

  const matchesToProcess =
    pendingMatches.slice(
      0,
      maximumMatches,
    );

  let matchesProcessed =
    0;

  let matchesSkipped =
    0;

  let matchesUnavailable =
    0;

  let teamStatisticsSaved =
    0;

  let apiRequests =
    0;

  let stoppedByDailyLimit =
    false;

  let stoppedByRateLimit =
    false;

  for (
    let index = 0;
    index <
    matchesToProcess.length;
    index += 1
  ) {
    const match =
      matchesToProcess[
        index
      ];

    console.log("");

    console.log(
      `[${index + 1}/${matchesToProcess.length}] ${match.homeTeam.name} - ${match.awayTeam.name}`,
    );

    try {
      apiRequests +=
        1;

      const response =
        await apiFootballRequest<
          ApiFootballFixtureStatisticsTeam[]
        >(
          "fixtures/statistics",
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
        for (const teamId of [match.homeTeamId, match.awayTeamId]) {
          await prisma.matchTeamStatistic.upsert({
            where: { matchId_teamId: { matchId: match.id, teamId } },
            update: { sourceUpdatedAt: new Date() },
            create: {
              matchId: match.id,
              teamId,
              expectedGoals: null,
              expectedGoalsAgainst: null,
              shots: null,
              shotsOnTarget: null,
              possession: null,
              corners: null,
              fouls: null,
              offsides: null,
              yellowCards: null,
              redCards: null,
              source: "API_FOOTBALL_NO_DATA",
              sourceUpdatedAt: new Date(),
            },
          });
        }

        console.log(
          "  Takım istatistiği bulunamadı; tekrar çağrılmaması için kapsam dışı işaretlendi.",
        );

        matchesSkipped +=
          1;

        matchesUnavailable +=
          1;

        continue;
      }

      let savedForMatch =
        0;

      const parsedTeams =
        response.response
          .map(
            (teamData) => {
              const teamId =
                teamData.team.id;

              const statistics =
                teamData.statistics;

              return {
                apiTeamId:
                  teamId,

                shots:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Total Shots",
                    ),
                  ),

                shotsOnTarget:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Shots on Goal",
                    ),
                  ),

                possession:
                  parseNumber(
                    getStatistic(
                      statistics,
                      "Ball Possession",
                    ),
                  ),

                corners:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Corner Kicks",
                    ),
                  ),

                fouls:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Fouls",
                    ),
                  ),

                offsides:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Offsides",
                    ),
                  ),

                yellowCards:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Yellow Cards",
                    ),
                  ),

                redCards:
                  parseInteger(
                    getStatistic(
                      statistics,
                      "Red Cards",
                    ),
                  ),
              };
            },
          );

      /*
       * DB Team ID eşlemesi.
       */
      const apiTeamIds =
        parsedTeams.map(
          (item) =>
            item.apiTeamId,
        );

      const databaseTeams =
        await prisma.team.findMany({
          where: {
            apiId: {
              in:
                apiTeamIds,
            },
          },

          select: {
            id: true,
            apiId: true,
          },
        });

      const dbTeamByApiId =
        new Map(
          databaseTeams.map(
            (team) => [
              team.apiId,
              team.id,
            ],
          ),
        );

      /*
       * API-Football fixtures/statistics
       * xG döndürmediği için expectedGoals
       * burada null bırakılıyor.
       *
       * Daha sonra gerçek xG kaynağı
       * bağlandığında güncellenecek.
       */
      for (
        const teamData
        of parsedTeams
      ) {
        const databaseTeamId =
          dbTeamByApiId.get(
            teamData.apiTeamId,
          );

        if (
          databaseTeamId ===
          undefined
        ) {
          console.log(
            `  DB takım bulunamadı: API team ${teamData.apiTeamId}`,
          );

          continue;
        }

        const source = hasRequestedStatistics(teamData)
          ? "API_FOOTBALL"
          : "API_FOOTBALL_PARTIAL";

        await prisma.matchTeamStatistic.upsert({
          where: {
            matchId_teamId: {
              matchId:
                match.id,

              teamId:
                databaseTeamId,
            },
          },

          update: {
            shots:
              teamData.shots,

            shotsOnTarget:
              teamData.shotsOnTarget,

            possession:
              teamData.possession,

            corners:
              teamData.corners,

            fouls:
              teamData.fouls,

            offsides:
              teamData.offsides,

            yellowCards:
              teamData.yellowCards,

            redCards:
              teamData.redCards,

            source,

            sourceUpdatedAt:
              new Date(),
          },

          create: {
            matchId:
              match.id,

            teamId:
              databaseTeamId,

            expectedGoals:
              null,

            expectedGoalsAgainst:
              null,

            shots:
              teamData.shots,

            shotsOnTarget:
              teamData.shotsOnTarget,

            possession:
              teamData.possession,

            corners:
              teamData.corners,

            fouls:
              teamData.fouls,

            offsides:
              teamData.offsides,

            yellowCards:
              teamData.yellowCards,

            redCards:
              teamData.redCards,

            source,

            sourceUpdatedAt:
              new Date(),
          },
        });

        teamStatisticsSaved +=
          1;

        savedForMatch +=
          1;
      }

      const storedTeamIds = new Set(
        parsedTeams
          .map((teamData) => dbTeamByApiId.get(teamData.apiTeamId))
          .filter((teamId): teamId is number => teamId !== undefined),
      );

      for (const teamId of [match.homeTeamId, match.awayTeamId]) {
        if (storedTeamIds.has(teamId)) continue;
        await prisma.matchTeamStatistic.upsert({
          where: { matchId_teamId: { matchId: match.id, teamId } },
          update: { sourceUpdatedAt: new Date() },
          create: {
            matchId: match.id,
            teamId,
            expectedGoals: null,
            expectedGoalsAgainst: null,
            shots: null,
            shotsOnTarget: null,
            possession: null,
            corners: null,
            fouls: null,
            offsides: null,
            yellowCards: null,
            redCards: null,
            source: "API_FOOTBALL_PARTIAL",
            sourceUpdatedAt: new Date(),
          },
        });
      }

      if (
        savedForMatch >= 2
      ) {
        matchesProcessed +=
          1;

        console.log(
          `  ${savedForMatch} takım istatistiği kaydedildi.`,
        );
      } else {
        matchesSkipped +=
          1;

        console.log(
          `  Eksik takım istatistiği: ${savedForMatch}/2`,
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
          "Kalan maçlara istek gönderilmeyecek.",
        );

        console.log(
          "Script güvenli şekilde durduruluyor.",
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
          "Kalan maçlara istek gönderilmeyecek.",
        );

        break;
      }

      matchesSkipped +=
        1;
    }
  }

  /*
   * Güncel DB coverage'ı yeniden hesapla.
   */
  const stored =
    await prisma.matchTeamStatistic.groupBy({
      by: [
        "matchId",
      ],

      where: {
        match: {
          seasonId:
            season.id,

          status:
            "FINISHED",

          ...(from || to
            ? {
                kickoffAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
      },

      _count: {
        teamId:
          true,
      },
    });

  const completeMatchCount =
    stored.filter(
      (item) =>
        item._count.teamId >=
        2,
    ).length;

  const remainingMatches =
    Math.max(
      matches.length -
        completeMatchCount,
      0,
    );

  return {
    candidateMatches: pendingMatches.length,
    matchesProcessed,
    matchesSkipped,
    matchesUnavailable,

    teamStatisticsSaved,

    apiRequests,

    remainingMatches,

    stoppedByDailyLimit,
    stoppedByRateLimit,
  };
}
