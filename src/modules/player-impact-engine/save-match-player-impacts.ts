import {
  prisma,
} from "@/lib/prisma";

import {
  PLAYER_IMPACT_MODEL_VERSION,
  savePlayerImpact,
} from "./save-player-impact";

export type SaveMatchPlayerImpactsResult = {
  matchId: number;

  homeTeam: string;
  awayTeam: string;

  lineupMode:
    | "CONFIRMED"
    | "PREDICTED"
    | "FALLBACK";

  playersFound: number;

  impactsSaved: number;
  skippedPlayers: number;

  staleImpactsDeleted: number;

  homeImpacts: number;
  awayImpacts: number;

  homeStarters: number;
  awayStarters: number;

  homeBench: number;
  awayBench: number;
};

type ImpactCandidate = {
  playerId: number;
  teamId: number;
  starter: boolean;
};

export async function saveMatchPlayerImpacts(
  matchId: number,
): Promise<SaveMatchPlayerImpactsResult> {
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
        id:
          matchId,
      },

      select: {
        id: true,
        kickoffAt: true,

        seasonId: true,

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
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  /*
   * Öncelik:
   *
   * 1. CONFIRMED lineup
   * 2. PREDICTED lineup
   * 3. Aktif takım kadrosu fallback
   */
  const confirmedLineups =
    await prisma.lineup.findMany({
      where: {
        matchId:
          match.id,

        status:
          "CONFIRMED",

        teamId: {
          in: [
            match.homeTeamId,
            match.awayTeamId,
          ],
        },
      },

      select: {
        teamId: true,

        players: {
          select: {
            playerId: true,
            starter: true,
          },
        },
      },
    });

  let lineupMode:
    | "CONFIRMED"
    | "PREDICTED"
    | "FALLBACK";

  let candidates:
    ImpactCandidate[];

  if (
    confirmedLineups.length === 2
  ) {
    lineupMode =
      "CONFIRMED";

    candidates =
      confirmedLineups.flatMap(
        (lineup) =>
          lineup.players.map(
            (player) => ({
              playerId:
                player.playerId,

              teamId:
                lineup.teamId,

              starter:
                player.starter,
            }),
          ),
      );
  } else {
    const predictedLineups =
      await prisma.lineup.findMany({
        where: {
          matchId:
            match.id,

          status:
            "PREDICTED",

          teamId: {
            in: [
              match.homeTeamId,
              match.awayTeamId,
            ],
          },
        },

        select: {
          teamId: true,

          players: {
            select: {
              playerId: true,
              starter: true,
            },
          },
        },
      });

    if (
      predictedLineups.length === 2
    ) {
      lineupMode =
        "PREDICTED";

      candidates =
        predictedLineups.flatMap(
          (lineup) =>
            lineup.players.map(
              (player) => ({
                playerId:
                  player.playerId,

                teamId:
                  lineup.teamId,

                starter:
                  player.starter,
              }),
            ),
        );
    } else {
      lineupMode =
        "FALLBACK";

      const players =
        await prisma.player.findMany({
          where: {
            isActive:
              true,

            teamId: {
              in: [
                match.homeTeamId,
                match.awayTeamId,
              ],
            },
          },

          select: {
            id: true,
            teamId: true,
          },
        });

      candidates =
        players
          .filter(
            (
              player,
            ): player is
              typeof player & {
                teamId: number;
              } =>
              player.teamId !==
              null,
          )
          .map(
            (player) => ({
              playerId:
                player.id,

              teamId:
                player.teamId,

              starter:
                false,
            }),
          );
    }
  }

  /*
   * Duplicate oyuncuları kaldır.
   */
  const uniqueCandidates =
    Array.from(
      new Map(
        candidates.map(
          (candidate) => [
            `${candidate.playerId}-${candidate.teamId}`,
            candidate,
          ],
        ),
      ).values(),
    );

  /*
   * --------------------------------------------------
   * STALE IMPACT TEMİZLİĞİ
   * --------------------------------------------------
   *
   * Daha önce fallback ile örneğin 103 oyuncu için
   * impact oluşturulmuş olabilir.
   *
   * Confirmed lineup artık 40 oyuncu içeriyorsa,
   * mevcut lineup dışında kalan eski impact kayıtları
   * bu maç/modelVersion için silinir.
   */
  const currentPlayerIds =
    uniqueCandidates.map(
      (candidate) =>
        candidate.playerId,
    );

  const staleDeleteResult =
    await prisma.playerImpactScore.deleteMany({
      where: {
        matchId:
          match.id,

        modelVersion:
          PLAYER_IMPACT_MODEL_VERSION,

        playerId: {
          notIn:
            currentPlayerIds,
        },
      },
    });

  let impactsSaved =
    0;

  let skippedPlayers =
    0;

  let homeImpacts =
    0;

  let awayImpacts =
    0;

  let homeStarters =
    0;

  let awayStarters =
    0;

  let homeBench =
    0;

  let awayBench =
    0;

  for (
    const candidate
    of uniqueCandidates
  ) {
    try {
      /*
       * DATA LEAKAGE KORUMASI:
       *
       * beforeDate = kickoffAt
       *
       * calculatePlayerImpact yalnızca
       * kickoff öncesindeki performansları
       * kullanır.
       */
      await savePlayerImpact({
        playerId:
          candidate.playerId,

        seasonId:
          match.seasonId,

        teamId:
          candidate.teamId,

        beforeDate:
          match.kickoffAt,

        matchId:
          match.id,
      });

      impactsSaved += 1;

      if (
        candidate.teamId ===
        match.homeTeamId
      ) {
        homeImpacts += 1;

        if (
          candidate.starter
        ) {
          homeStarters += 1;
        } else {
          homeBench += 1;
        }
      }

      if (
        candidate.teamId ===
        match.awayTeamId
      ) {
        awayImpacts += 1;

        if (
          candidate.starter
        ) {
          awayStarters += 1;
        } else {
          awayBench += 1;
        }
      }
    } catch (error) {
      skippedPlayers += 1;

      console.warn(
        `Player impact atlandı: playerId=${candidate.playerId}`,
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }

  return {
    matchId:
      match.id,

    homeTeam:
      match.homeTeam.name,

    awayTeam:
      match.awayTeam.name,

    lineupMode,

    playersFound:
      uniqueCandidates.length,

    impactsSaved,

    skippedPlayers,

    staleImpactsDeleted:
      staleDeleteResult.count,

    homeImpacts,

    awayImpacts,

    homeStarters,

    awayStarters,

    homeBench,

    awayBench,
  };
}