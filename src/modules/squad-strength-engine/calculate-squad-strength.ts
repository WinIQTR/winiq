import {
  prisma,
} from "@/lib/prisma";

import {
  PLAYER_IMPACT_MODEL_VERSION,
} from "@/modules/player-impact-engine";

import type {
  SquadStrengthLineupMode,
  SquadStrengthResult,
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

function weightedAverage(
  values: Array<{
    score: number;
    weight: number;
  }>,
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  let weightedTotal =
    0;

  let totalWeight =
    0;

  for (
    const value
    of values
  ) {
    weightedTotal +=
      value.score *
      value.weight;

    totalWeight +=
      value.weight;
  }

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

export async function calculateSquadStrength(
  options: {
    matchId: number;
    teamId: number;
  },
): Promise<SquadStrengthResult> {
  const {
    matchId,
    teamId,
  } = options;

  if (
    !Number.isInteger(
      matchId,
    ) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(
      teamId,
    ) ||
    teamId <= 0
  ) {
    throw new Error(
      "teamId pozitif bir tam sayı olmalıdır.",
    );
  }

  const match =
    await prisma.match.findUnique({
      where: {
        id:
          matchId,
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,
      },
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  if (
    teamId !==
      match.homeTeamId &&
    teamId !==
      match.awayTeamId
  ) {
    throw new Error(
      `${teamId} ID değerine sahip takım bu maçta yer almıyor.`,
    );
  }

  const team =
    await prisma.team.findUnique({
      where: {
        id:
          teamId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!team) {
    throw new Error(
      `${teamId} ID değerine sahip takım bulunamadı.`,
    );
  }

  /*
   * Öncelik:
   *
   * 1. CONFIRMED
   * 2. PREDICTED
   */
  let lineup =
    await prisma.lineup.findUnique({
      where: {
        matchId_teamId_status: {
          matchId,
          teamId,

          status:
            "CONFIRMED",
        },
      },

      select: {
        id: true,

        status: true,

        isConfirmed: true,

        players: {
          select: {
            playerId: true,

            starter: true,

            position: true,

            player: {
              select: {
                name: true,
                position: true,
              },
            },
          },
        },
      },
    });

  let lineupMode:
    SquadStrengthLineupMode =
      "CONFIRMED";

  if (!lineup) {
    lineup =
      await prisma.lineup.findUnique({
        where: {
          matchId_teamId_status: {
            matchId,
            teamId,

            status:
              "PREDICTED",
          },
        },

        select: {
          id: true,

          status: true,

          isConfirmed: true,

          players: {
            select: {
              playerId: true,

              starter: true,

              position: true,

              player: {
                select: {
                  name: true,
                  position: true,
                },
              },
            },
          },
        },
      });

    lineupMode =
      "PREDICTED";
  }

  if (!lineup) {
    throw new Error(
      `${team.name} için confirmed veya predicted lineup bulunamadı.`,
    );
  }

  const playerIds =
    lineup.players.map(
      (player) =>
        player.playerId,
    );

  /*
   * Player impact ile beraber artık
   * dataQualityScore da okunuyor.
   */
  const impacts =
    await prisma.playerImpactScore.findMany({
      where: {
        matchId,

        teamId,

        playerId: {
          in:
            playerIds,
        },

        modelVersion:
          PLAYER_IMPACT_MODEL_VERSION,
      },

      select: {
        playerId: true,

        overallImpactScore: true,

        dataQualityScore: true,
      },
    });

  const impactByPlayerId =
    new Map(
      impacts.map(
        (impact) => [
          impact.playerId,
          {
            score:
              impact.overallImpactScore,

            dataQualityScore:
              impact.dataQualityScore,
          },
        ],
      ),
    );

  const warnings:
    string[] = [];

  const playersWithImpact =
    lineup.players
      .map(
        (player) => {
          const impact =
            impactByPlayerId.get(
              player.playerId,
            );

          if (
            impact ===
            undefined
          ) {
            return null;
          }

          /*
           * Lineup position varsa
           * onu tercih ediyoruz.
           *
           * API:
           * G / D / M / F
           */
          const lineupPosition =
            player.position
              ?.trim()
              .toUpperCase();

          let position:
            | "GOALKEEPER"
            | "DEFENDER"
            | "MIDFIELDER"
            | "FORWARD"
            | "UNKNOWN";

          switch (
            lineupPosition
          ) {
            case "G":
              position =
                "GOALKEEPER";

              break;

            case "D":
              position =
                "DEFENDER";

              break;

            case "M":
              position =
                "MIDFIELDER";

              break;

            case "F":
              position =
                "FORWARD";

              break;

            default:
              position =
                player.player
                  .position;
          }

          return {
            playerId:
              player.playerId,

            playerName:
              player.player.name,

            starter:
              player.starter,

            position,

            impact:
              impact.score,

            dataQualityScore:
              impact.dataQualityScore,
          };
        },
      )
      .filter(
        (
          player,
        ): player is NonNullable<
          typeof player
        > =>
          player !== null,
      );

  const missingImpactCount =
    lineup.players.length -
    playersWithImpact.length;

  if (
    missingImpactCount > 0
  ) {
    warnings.push(
      `${missingImpactCount} lineup oyuncusu için PlayerImpactScore bulunamadı.`,
    );
  }

  const starters =
    playersWithImpact.filter(
      (player) =>
        player.starter,
    );

  const bench =
    playersWithImpact.filter(
      (player) =>
        !player.starter,
    );

  /*
   * ==================================================
   * TAKIM GÜÇ SKORLARI
   * ==================================================
   */

  const startingEleven =
    average(
      starters.map(
        (player) =>
          player.impact,
      ),
    ) ??
    0;

  /*
   * Bench strength için en güçlü 5 oyuncu.
   */
  const topBench =
    [...bench]
      .sort(
        (
          first,
          second,
        ) =>
          second.impact -
          first.impact,
      )
      .slice(
        0,
        5,
      );

  const benchScore =
    average(
      topBench.map(
        (player) =>
          player.impact,
      ),
    ) ??
    0;

  const goalkeeper =
    average(
      starters
        .filter(
          (player) =>
            player.position ===
            "GOALKEEPER",
        )
        .map(
          (player) =>
            player.impact,
        ),
    ) ??
    0;

  const defence =
    average(
      starters
        .filter(
          (player) =>
            player.position ===
            "DEFENDER",
        )
        .map(
          (player) =>
            player.impact,
        ),
    ) ??
    0;

  const midfield =
    average(
      starters
        .filter(
          (player) =>
            player.position ===
            "MIDFIELDER",
        )
        .map(
          (player) =>
            player.impact,
        ),
    ) ??
    0;

  const attack =
    average(
      starters
        .filter(
          (player) =>
            player.position ===
            "FORWARD",
        )
        .map(
          (player) =>
            player.impact,
        ),
    ) ??
    0;

  const completeBenchAverage =
    average(
      bench.map(
        (player) =>
          player.impact,
      ),
    ) ??
    0;

  const squadDepth =
    round(
      benchScore *
        0.7 +
      completeBenchAverage *
        0.3,
    );

  /*
   * Injury Engine henüz bağlı değil.
   */
  const missingPlayerPenalty =
    0;

  /*
   * Confirmed lineup:
   * %100
   *
   * Predicted lineup:
   * %70
   */
  const lineupCertainty =
    lineupMode ===
    "CONFIRMED"
      ? 100
      : 70;

  const positionalBalance =
    average(
      [
        goalkeeper,
        defence,
        midfield,
        attack,
      ].filter(
        (score) =>
          score > 0,
      ),
    ) ??
    0;

  /*
   * Overall squad:
   *
   * Starting XI      %65
   * Bench            %10
   * Squad Depth      %10
   * Position Balance %15
   */
  const rawOverall =
    weightedAverage([
      {
        score:
          startingEleven,

        weight:
          0.65,
      },

      {
        score:
          benchScore,

        weight:
          0.10,
      },

      {
        score:
          squadDepth,

        weight:
          0.10,
      },

      {
        score:
          positionalBalance,

        weight:
          0.15,
      },
    ]) ??
    0;

  const overallSquad =
    round(
      clamp(
        rawOverall -
          missingPlayerPenalty,
        0,
        100,
      ),
    );

  /*
   * ==================================================
   * DATA QUALITY
   * ==================================================
   *
   * Artık yalnızca "impact var mı?"
   * diye bakmıyoruz.
   *
   * Oyuncu impact kayıtlarının kendi
   * veri kaliteleri squad quality'e giriyor.
   */

  const expectedStarterCount =
    11;

  const starterCoverage =
    clamp(
      starters.length /
        expectedStarterCount,
      0,
      1,
    );

  const lineupImpactCoverage =
    lineup.players.length > 0
      ? clamp(
          playersWithImpact.length /
            lineup.players.length,
          0,
          1,
        )
      : 0;

  /*
   * İlk 11 veri kalitesi.
   */
  const starterDataQuality =
    average(
      starters.map(
        (player) =>
          player.dataQualityScore,
      ),
    ) ??
    0;

  /*
   * Bench veri kalitesi.
   */
  const benchDataQuality =
    average(
      bench.map(
        (player) =>
          player.dataQualityScore,
      ),
    ) ??
    0;

  /*
   * İlk 11 bench'ten daha önemli.
   *
   * %80 starter
   * %20 bench
   */
  const playerDataQuality =
    round(
      starterDataQuality *
        0.8 +
      benchDataQuality *
        0.2,
    );

  /*
   * Nihai Squad Data Quality:
   *
   * Starter completeness    %25
   * Impact coverage         %25
   * Player data quality     %50
   */
  const dataQualityScore =
    round(
      clamp(
        starterCoverage *
          25 +
        lineupImpactCoverage *
          25 +
        playerDataQuality *
          0.50,
        0,
        100,
      ),
    );

  if (
    starters.length !==
    11
  ) {
    warnings.push(
      `Beklenen 11 starter yerine ${starters.length} impact oyuncusu kullanıldı.`,
    );
  }

  if (
    playerDataQuality <
    50
  ) {
    warnings.push(
      `Oyuncu veri kalitesi düşük: ${playerDataQuality}/100.`,
    );
  }

  return {
    match: {
      id:
        match.id,

      kickoffAt:
        match.kickoffAt,
    },

    team: {
      id:
        team.id,

      name:
        team.name,
    },

    lineupMode,

    players: {
      total:
        playersWithImpact.length,

      starters:
        starters.length,

      bench:
        bench.length,
    },

    scores: {
      startingEleven,

      bench:
        benchScore,

      goalkeeper,

      defence,

      midfield,

      attack,

      missingPlayerPenalty,

      squadDepth,

      overallSquad,

      lineupCertainty,
    },

    dataQualityScore,

    warnings,
  };
}