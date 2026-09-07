import {
  prisma,
} from "@/lib/prisma";

import {
  calculatePlayerForm,
} from "@/modules/player-form-engine";

import type {
  PlayerImpactResult,
} from "./types";

const WEIGHTS = {
  form: 0.35,
  quality: 0.25,
  fitness: 0.15,
  importance: 0.15,
  tacticalFit: 0.05,
  marketValue: 0.05,
};

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

function ratingToScore(
  rating: number | null,
): number {
  if (
    rating === null
  ) {
    return 50;
  }

  /*
   * Yaklaşık dönüşüm:
   *
   * 5.0 -> 0
   * 6.0 -> 25
   * 7.0 -> 50
   * 8.0 -> 75
   * 9.0 -> 100
   */
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

function calculateFitnessScore(options: {
  appearances: number;
  starts: number;
  minutes: number;
  recentMinutes: number;
}): number {
  if (
    options.appearances <= 0
  ) {
    return 25;
  }

  const minutesPerAppearance =
    options.minutes /
    options.appearances;

  const startRate =
    options.starts /
    options.appearances;

  /*
   * Son 5 maçta teorik maksimum:
   *
   * 5 * 90 = 450 dakika
   */
  const recentMinutesScore =
    clamp(
      (
        options.recentMinutes /
        450
      ) * 100,
      0,
      100,
    );

  const minutesScore =
    clamp(
      (
        minutesPerAppearance /
        90
      ) * 100,
      0,
      100,
    );

  const startScore =
    clamp(
      startRate * 100,
      0,
      100,
    );

  return round(
    minutesScore * 0.4 +
      startScore * 0.25 +
      recentMinutesScore * 0.35,
  );
}

function calculateImportanceScore(options: {
  appearances: number;
  starts: number;
  minutes: number;

  goals: number;
  assists: number;

  position: string;
}): number {
  if (
    options.appearances <= 0
  ) {
    return 20;
  }

  const startRate =
    options.starts /
    options.appearances;

  const minutesPerAppearance =
    options.minutes /
    options.appearances;

  const usageScore =
    clamp(
      startRate * 60 +
        (
          minutesPerAppearance /
          90
        ) *
          40,
      0,
      100,
    );

  /*
   * Hücum üretimi pozisyona göre
   * farklı ağırlıklandırılır.
   */
  let productionScore =
    50;

  if (
    options.position ===
    "FORWARD"
  ) {
    const goalsPerMatch =
      options.goals /
      options.appearances;

    const assistsPerMatch =
      options.assists /
      options.appearances;

    productionScore =
      clamp(
        35 +
          goalsPerMatch * 60 +
          assistsPerMatch * 35,
        0,
        100,
      );
  } else if (
    options.position ===
    "MIDFIELDER"
  ) {
    const goalsPerMatch =
      options.goals /
      options.appearances;

    const assistsPerMatch =
      options.assists /
      options.appearances;

    productionScore =
      clamp(
        40 +
          goalsPerMatch * 40 +
          assistsPerMatch * 50,
        0,
        100,
      );
  } else if (
    options.position ===
    "DEFENDER"
  ) {
    productionScore =
      clamp(
        45 +
          (
            options.goals /
            options.appearances
          ) *
            30 +
          (
            options.assists /
            options.appearances
          ) *
            25,
        0,
        100,
      );
  } else if (
    options.position ===
    "GOALKEEPER"
  ) {
    productionScore =
      50;
  }

  return round(
    usageScore * 0.8 +
      productionScore * 0.2,
  );
}

function calculateTacticalFitScore(
  position: string,
): number {
  /*
   * Formation-role matching daha sonra
   * lineup grid üzerinden geliştirilecek.
   *
   * Şimdilik gerçek pozisyonu bilinen
   * oyuncular için kontrollü nötr puan.
   */
  switch (
    position
  ) {
    case "GOALKEEPER":
    case "DEFENDER":
    case "MIDFIELDER":
    case "FORWARD":
      return 70;

    default:
      return 50;
  }
}

function calculateMarketValueScore(
  marketValue: number | null,
): number {
  if (
    marketValue === null ||
    marketValue <= 0
  ) {
    return 50;
  }

  const score =
    (
      Math.log10(
        marketValue,
      ) -
      5
    ) *
    25;

  return round(
    clamp(
      score,
      0,
      100,
    ),
  );
}

export async function calculatePlayerImpact(
  options: {
    playerId: number;

    seasonId: number;

    teamId: number;

    beforeDate: Date;

    matchId?: number;
  },
): Promise<PlayerImpactResult> {
  const {
    playerId,
    seasonId,
    teamId,
    beforeDate,
    matchId,
  } = options;

  if (
    !Number.isInteger(
      playerId,
    ) ||
    playerId <= 0
  ) {
    throw new Error(
      "playerId pozitif tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      seasonId,
    ) ||
    seasonId <= 0
  ) {
    throw new Error(
      "seasonId pozitif tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      teamId,
    ) ||
    teamId <= 0
  ) {
    throw new Error(
      "teamId pozitif tam sayı olmalıdır.",
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

        position: true,

        teamId: true,

        marketValue: true,

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
   * =======================================================
   * KRİTİK DATA LEAKAGE KORUMASI
   * =======================================================
   *
   * PlayerSeasonStatistic kullanmıyoruz.
   *
   * Çünkü historical prediction sırasında bu kayıt
   * sezon sonu toplamlarını içerebilir.
   *
   * Sadece:
   *
   * kickoffAt < beforeDate
   *
   * olan maç performansları kullanılır.
   */
  const historicalPerformances =
    await prisma.playerMatchPerformance.findMany({
      where: {
        playerId,

        seasonId,

        teamId,

        match: {
          kickoffAt: {
            lt:
              beforeDate,
          },
        },
      },

      select: {
        minutes: true,

        starter: true,

        rating: true,

        goals: true,
        assists: true,

        match: {
          select: {
            kickoffAt: true,
          },
        },
      },

      orderBy: {
        match: {
          kickoffAt:
            "desc",
        },
      },
    });

  const appearances =
    historicalPerformances.filter(
      (performance) =>
        performance.minutes > 0,
    ).length;

  const starts =
    historicalPerformances.filter(
      (performance) =>
        performance.starter,
    ).length;

  const minutes =
    historicalPerformances.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.minutes,
      0,
    );

  const goals =
    historicalPerformances.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.goals,
      0,
    );

  const assists =
    historicalPerformances.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.assists,
      0,
    );

  const historicalRatings =
    historicalPerformances
      .map(
        (performance) =>
          performance.rating,
      )
      .filter(
        (
          rating,
        ): rating is number =>
          rating !== null,
      );

  /*
   * "Season Rating" artık sezon sonu averageRating
   * değil.
   *
   * beforeDate öncesindeki sezon performanslarının
   * ortalamasıdır.
   */
  const seasonRating =
    average(
      historicalRatings,
    );

  const recentFive =
    historicalPerformances.slice(
      0,
      5,
    );

  const recentMinutes =
    recentFive.reduce(
      (
        total,
        performance,
      ) =>
        total +
        performance.minutes,
      0,
    );

  const form =
    await calculatePlayerForm({
      playerId,
      beforeDate,
    });

  const warnings:
    string[] = [
      ...form.warnings,
    ];

  if (
    historicalPerformances.length ===
    0
  ) {
    warnings.push(
      "Oyuncu için maç öncesi performans kaydı bulunamadı.",
    );
  }

  if (
    seasonRating === null
  ) {
    warnings.push(
      "Oyuncu için maç öncesi rating ortalaması hesaplanamadı.",
    );
  }

  const marketValue =
    player.marketValue !==
      null
      ? Number(
          player.marketValue,
        )
      : null;

  const formScore =
    form.formScore ??
    50;

  const qualityScore =
    ratingToScore(
      seasonRating,
    );

  const fitnessScore =
    calculateFitnessScore({
      appearances,
      starts,
      minutes,
      recentMinutes,
    });

  const importanceScore =
    calculateImportanceScore({
      appearances,
      starts,
      minutes,

      goals,
      assists,

      position:
        player.position,
    });

  const tacticalFitScore =
    calculateTacticalFitScore(
      player.position,
    );

  const marketValueScore =
    calculateMarketValueScore(
      marketValue,
    );

  const overall =
    round(
      formScore *
        WEIGHTS.form +
        qualityScore *
          WEIGHTS.quality +
        fitnessScore *
          WEIGHTS.fitness +
        importanceScore *
          WEIGHTS.importance +
        tacticalFitScore *
          WEIGHTS.tacticalFit +
        marketValueScore *
          WEIGHTS.marketValue,
    );

  const componentAvailability = [
    form.samples
      .totalRatedMatches >= 3,

    seasonRating !==
      null,

    appearances > 0,

    minutes > 0,

    player.position !==
      "UNKNOWN",

    marketValue !==
      null,
  ];

  const availableCount =
    componentAvailability.filter(
      Boolean,
    ).length;

  const dataQualityScore =
    round(
      (
        availableCount /
        componentAvailability.length
      ) *
        100,
    );

  let match:
    | {
        id: number;
        kickoffAt: Date;
      }
    | null = null;

  if (
    matchId !== undefined
  ) {
    const matchRecord =
      await prisma.match.findUnique({
        where: {
          id:
            matchId,
        },

        select: {
          id: true,
          kickoffAt: true,
        },
      });

    if (!matchRecord) {
      throw new Error(
        `${matchId} ID değerine sahip maç bulunamadı.`,
      );
    }

    match =
      matchRecord;
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

    match,

    seasonId,

    teamId,

    scores: {
      form:
        formScore,

      quality:
        qualityScore,

      fitness:
        fitnessScore,

      tacticalFit:
        tacticalFitScore,

      importance:
        importanceScore,

      marketValue:
        marketValueScore,

      overall,
    },

    dataQualityScore,

    components: {
      recentRating:
        form.samples
          .weightedRecentRating,

      seasonRating,

      appearances,

      starts,

      minutes,

      goals,

      assists,

      marketValue,
    },

    warnings,
  };
}