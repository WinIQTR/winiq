import {
  prisma,
} from "@/lib/prisma";

import type {
  PlayerFormResult,
  PlayerFormTrend,
  PlayerRecentMatch,
} from "./types";

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function average(
  values: number[],
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  return round(
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    ) /
      values.length,
  );
}

function averageWindow(
  values: number[],
  count: number,
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  return average(
    values.slice(
      0,
      count,
    ),
  );
}

function strictAverageWindow(
  values: number[],
  start: number,
  count: number,
): number | null {
  const selected =
    values.slice(
      start,
      start + count,
    );

  if (
    selected.length !== count
  ) {
    return null;
  }

  return average(
    selected,
  );
}

function calculateWeightedRecentRating(
  ratings: number[],
): number | null {
  if (
    ratings.length === 0
  ) {
    return null;
  }

  const selected =
    ratings.slice(
      0,
      5,
    );

  const weights =
    [5, 4, 3, 2, 1];

  let weightedTotal =
    0;

  let totalWeight =
    0;

  selected.forEach(
    (
      rating,
      index,
    ) => {
      const weight =
        weights[index];

      weightedTotal +=
        rating * weight;

      totalWeight +=
        weight;
    },
  );

  if (
    totalWeight <= 0
  ) {
    return null;
  }

  return round(
    weightedTotal /
      totalWeight,
  );
}

function determineTrend(options: {
  totalRatedMatches: number;
  last3: number | null;
  previous3: number | null;
}): {
  type: PlayerFormTrend;
  change: number | null;
  description: string;
} {
  /*
   * Trend için mutlaka iki tam 3 maçlık
   * dönem gerekir:
   *
   * Son 3
   * vs
   * Önceki 3
   *
   * Yani minimum 6 ratingli maç.
   */
  if (
    options.totalRatedMatches < 6 ||
    options.last3 === null ||
    options.previous3 === null
  ) {
    return {
      type:
        "INSUFFICIENT_DATA",

      change:
        null,

      description:
        "Form trendi için en az 6 ratingli maç gerekir.",
    };
  }

  const change =
    round(
      options.last3 -
        options.previous3,
    );

  if (
    change >= 0.7
  ) {
    return {
      type:
        "STRONG_UP",

      change,

      description:
        `Oyuncu formu güçlü yükselişte (+${change.toFixed(
          2,
        )}).`,
    };
  }

  if (
    change >= 0.25
  ) {
    return {
      type:
        "UP",

      change,

      description:
        `Oyuncu formu yükseliyor (+${change.toFixed(
          2,
        )}).`,
    };
  }

  if (
    change <= -0.7
  ) {
    return {
      type:
        "STRONG_DOWN",

      change,

      description:
        `Oyuncu formunda güçlü düşüş var (${change.toFixed(
          2,
        )}).`,
    };
  }

  if (
    change <= -0.25
  ) {
    return {
      type:
        "DOWN",

      change,

      description:
        `Oyuncu formu düşüyor (${change.toFixed(
          2,
        )}).`,
    };
  }

  return {
    type:
      "STABLE",

    change,

    description:
      "Oyuncunun son 3 maç performansı önceki 3 maça yakın; form istikrarlı.",
  };
}

function ratingToFormScore(
  rating: number | null,
): number | null {
  if (
    rating === null
  ) {
    return null;
  }

  return round(
    clamp(
      (
        (rating - 5) /
        4
      ) * 100,
      0,
      100,
    ),
  );
}

function calculateDataQualityScore(
  ratedMatches: number,
): number {
  /*
   * İlk form değerlendirmesi için
   * 5 ratingli maç tam kapsama kabul edilir.
   *
   * Trend yine ayrıca minimum 6 maç ister.
   */
  return round(
    clamp(
      (
        ratedMatches /
        5
      ) * 100,
      0,
      100,
    ),
  );
}

export async function calculatePlayerForm(
  options: {
    playerId: number;
    beforeDate: Date;
  },
): Promise<PlayerFormResult> {
  const {
    playerId,
    beforeDate,
  } = options;

  if (
    !Number.isInteger(
      playerId,
    ) ||
    playerId <= 0
  ) {
    throw new Error(
      "playerId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    Number.isNaN(
      beforeDate.getTime(),
    )
  ) {
    throw new Error(
      "beforeDate geçerli bir tarih olmalıdır.",
    );
  }

  const player =
    await prisma.player.findUnique({
      where: {
        id:
          playerId,
      },

      select: {
        id: true,
        name: true,

        teamId: true,

        position: true,

        team: {
          select: {
            name: true,
          },
        },
      },
    });

  if (!player) {
    throw new Error(
      `${playerId} ID değerine sahip oyuncu bulunamadı.`,
    );
  }

  /*
   * Data leakage koruması:
   *
   * Sadece tahmin tarihinden ÖNCE oynanan
   * maçların performansları kullanılır.
   */
  const performances =
    await prisma.playerMatchPerformance.findMany({
      where: {
        playerId,

        rating: {
          not: null,
        },

        match: {
          kickoffAt: {
            lt:
              beforeDate,
          },
        },
      },

      select: {
        matchId: true,

        minutes: true,
        starter: true,

        rating: true,

        goals: true,
        assists: true,

        teamId: true,

        match: {
          select: {
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
          },
        },
      },

      orderBy: {
        match: {
          kickoffAt:
            "desc",
        },
      },

      take: 20,
    });

  const validPerformances =
    performances.filter(
      (
        performance,
      ): performance is
        typeof performance & {
          rating: number;
        } =>
        performance.rating !==
        null,
    );

  const ratings =
    validPerformances.map(
      (performance) =>
        performance.rating,
    );

  const totalRatedMatches =
    ratings.length;

  const last1 =
    averageWindow(
      ratings,
      1,
    );

  const last3 =
    averageWindow(
      ratings,
      3,
    );

  const last5 =
    averageWindow(
      ratings,
      5,
    );

  const last10 =
    averageWindow(
      ratings,
      10,
    );

  /*
   * Önceki 3 ancak 3 TAM kayıt varsa
   * hesaplanır.
   *
   * ratings:
   *
   * 0,1,2 → Son 3
   * 3,4,5 → Önceki 3
   */
  const previous3 =
    strictAverageWindow(
      ratings,
      3,
      3,
    );

  const weightedRecentRating =
    calculateWeightedRecentRating(
      ratings,
    );

  const trend =
    determineTrend({
      totalRatedMatches,
      last3,
      previous3,
    });

  const recentFive =
    validPerformances.slice(
      0,
      5,
    );

  const last5Minutes =
    recentFive.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.minutes,
      0,
    );

  const last5Starts =
    recentFive.filter(
      (performance) =>
        performance.starter,
    ).length;

  const last5Goals =
    recentFive.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.goals,
      0,
    );

  const last5Assists =
    recentFive.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.assists,
      0,
    );

  const recentMatches:
    PlayerRecentMatch[] =
    validPerformances
      .slice(
        0,
        10,
      )
      .map(
        (performance) => {
          const isHome =
            performance.match
              .homeTeamId ===
            performance.teamId;

          const opponent =
            isHome
              ? performance.match
                  .awayTeam.name
              : performance.match
                  .homeTeam.name;

          return {
            matchId:
              performance.matchId,

            kickoffAt:
              performance.match
                .kickoffAt,

            opponent,

            homeAway:
              isHome
                ? "HOME"
                : "AWAY",

            minutes:
              performance.minutes,

            starter:
              performance.starter,

            rating:
              performance.rating,

            goals:
              performance.goals,

            assists:
              performance.assists,
          };
        },
      );

  const warnings:
    string[] = [];

  if (
    totalRatedMatches === 0
  ) {
    warnings.push(
      "Oyuncu için tahmin tarihinden önce rating bulunan maç yok.",
    );
  }

  if (
    totalRatedMatches < 3
  ) {
    warnings.push(
      "Son 3 maç formu için yeterli ratingli maç bulunmuyor.",
    );
  }

  if (
    totalRatedMatches < 5
  ) {
    warnings.push(
      "Son 5 maç form skoru eksik örneklemle hesaplanıyor.",
    );
  }

  if (
    totalRatedMatches < 6
  ) {
    warnings.push(
      "Trend hesaplamak için en az 6 ratingli maç gerekir.",
    );
  }

  return {
    player: {
      id:
        player.id,

      name:
        player.name,

      teamId:
        player.teamId,

      teamName:
        player.team?.name ??
        null,

      position:
        player.position,
    },

    beforeDate,

    samples: {
      totalRatedMatches,

      last1,

      last3,

      last5,

      last10,

      previous3,

      weightedRecentRating,
    },

    production: {
      last5Minutes,
      last5Starts,

      last5Goals,
      last5Assists,
    },

    trend,

    formScore:
      ratingToFormScore(
        weightedRecentRating,
      ),

    dataQualityScore:
      calculateDataQualityScore(
        totalRatedMatches,
      ),

    recentMatches,

    warnings,
  };
}