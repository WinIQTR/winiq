import {
  prisma,
} from "@/lib/prisma";

import {
  PLAYER_IMPACT_MODEL_VERSION,
} from "@/modules/player-impact-engine";

export type SquadFeatureReadiness = {
  matchId: number;

  ready: boolean;

  home: {
    lineupFound: boolean;
    starterCount: number;
    benchCount: number;
    impactCount: number;
  };

  away: {
    lineupFound: boolean;
    starterCount: number;
    benchCount: number;
    impactCount: number;
  };

  warnings: string[];
};

export async function checkSquadFeatureReadiness(
  matchId: number,
): Promise<SquadFeatureReadiness> {
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

        homeTeamId: true,
        awayTeamId: true,
      },
    });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  const lineups =
    await prisma.lineup.findMany({
      where: {
        matchId,

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

  const homeLineup =
    lineups.find(
      (lineup) =>
        lineup.teamId ===
        match.homeTeamId,
    );

  const awayLineup =
    lineups.find(
      (lineup) =>
        lineup.teamId ===
        match.awayTeamId,
    );

  const homePlayerIds =
    homeLineup?.players.map(
      (player) =>
        player.playerId,
    ) ?? [];

  const awayPlayerIds =
    awayLineup?.players.map(
      (player) =>
        player.playerId,
    ) ?? [];

  const [
    homeImpactCount,
    awayImpactCount,
  ] =
    await Promise.all([
      prisma.playerImpactScore.count({
        where: {
          matchId,

          teamId:
            match.homeTeamId,

          modelVersion:
            PLAYER_IMPACT_MODEL_VERSION,

          playerId: {
            in:
              homePlayerIds,
          },
        },
      }),

      prisma.playerImpactScore.count({
        where: {
          matchId,

          teamId:
            match.awayTeamId,

          modelVersion:
            PLAYER_IMPACT_MODEL_VERSION,

          playerId: {
            in:
              awayPlayerIds,
          },
        },
      }),
    ]);

  const homeStarterCount =
    homeLineup?.players.filter(
      (player) =>
        player.starter,
    ).length ?? 0;

  const homeBenchCount =
    homeLineup?.players.filter(
      (player) =>
        !player.starter,
    ).length ?? 0;

  const awayStarterCount =
    awayLineup?.players.filter(
      (player) =>
        player.starter,
    ).length ?? 0;

  const awayBenchCount =
    awayLineup?.players.filter(
      (player) =>
        !player.starter,
    ).length ?? 0;

  const warnings:
    string[] = [];

  if (!homeLineup) {
    warnings.push(
      "Ev sahibi confirmed lineup bulunamadı.",
    );
  }

  if (!awayLineup) {
    warnings.push(
      "Deplasman confirmed lineup bulunamadı.",
    );
  }

  if (
    homeLineup &&
    homeStarterCount !== 11
  ) {
    warnings.push(
      `Ev sahibi starter sayısı ${homeStarterCount}; beklenen 11.`,
    );
  }

  if (
    awayLineup &&
    awayStarterCount !== 11
  ) {
    warnings.push(
      `Deplasman starter sayısı ${awayStarterCount}; beklenen 11.`,
    );
  }

  if (
    homeLineup &&
    homeImpactCount <
      homeLineup.players.length
  ) {
    warnings.push(
      `Ev sahibi impact kapsamı ${homeImpactCount}/${homeLineup.players.length}.`,
    );
  }

  if (
    awayLineup &&
    awayImpactCount <
      awayLineup.players.length
  ) {
    warnings.push(
      `Deplasman impact kapsamı ${awayImpactCount}/${awayLineup.players.length}.`,
    );
  }

  const homeReady =
    Boolean(homeLineup) &&
    homeStarterCount === 11 &&
    homeImpactCount ===
      homePlayerIds.length;

  const awayReady =
    Boolean(awayLineup) &&
    awayStarterCount === 11 &&
    awayImpactCount ===
      awayPlayerIds.length;

  return {
    matchId,

    ready:
      homeReady &&
      awayReady,

    home: {
      lineupFound:
        Boolean(
          homeLineup,
        ),

      starterCount:
        homeStarterCount,

      benchCount:
        homeBenchCount,

      impactCount:
        homeImpactCount,
    },

    away: {
      lineupFound:
        Boolean(
          awayLineup,
        ),

      starterCount:
        awayStarterCount,

      benchCount:
        awayBenchCount,

      impactCount:
        awayImpactCount,
    },

    warnings,
  };
}