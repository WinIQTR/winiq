import {
  MatchStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

export type HeadToHeadMatch = {
  matchId: number;
  kickoffAt: Date;

  homeTeamId: number;
  awayTeamId: number;

  homeScore: number;
  awayScore: number;
};

export type HeadToHeadResult = {
  matchId: number;

  homeTeamId: number;
  awayTeamId: number;

  sampleSize: number;

  homeWins: number;
  draws: number;
  awayWins: number;

  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;

  homeGoalsPerGame: number;
  awayGoalsPerGame: number;
  totalGoalsPerGame: number;

  matches: HeadToHeadMatch[];

  warnings: string[];
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

export async function calculateHeadToHead(
  matchId: number,
  limit = 5,
): Promise<HeadToHeadResult> {
  if (
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    throw new Error(
      "H2H limit pozitif bir tam sayı olmalıdır.",
    );
  }

  const targetMatch =
    await prisma.match.findUnique({
      where: {
        id: matchId,
      },

      select: {
        id: true,
        kickoffAt: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    });

  if (!targetMatch) {
    throw new Error(
      `Maç bulunamadı: ${matchId}`,
    );
  }

  /*
   * ÖNEMLİ:
   *
   * Yalnızca hedef maçın kickoffAt
   * zamanından ÖNCE oynanmış maçları
   * kullanıyoruz.
   *
   * Böylece gelecekteki verinin
   * geçmiş tahmine sızmasını engelliyoruz.
   */

  const historicalMatches =
    await prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,

        kickoffAt: {
          lt: targetMatch.kickoffAt,
        },

        homeScore: {
          not: null,
        },

        awayScore: {
          not: null,
        },

        OR: [
          {
            homeTeamId:
              targetMatch.homeTeamId,

            awayTeamId:
              targetMatch.awayTeamId,
          },

          {
            homeTeamId:
              targetMatch.awayTeamId,

            awayTeamId:
              targetMatch.homeTeamId,
          },
        ],
      },

      select: {
        id: true,
        kickoffAt: true,

        homeTeamId: true,
        awayTeamId: true,

        homeScore: true,
        awayScore: true,
      },

      orderBy: {
        kickoffAt: "desc",
      },

      take: limit,
    });

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  let homeGoals = 0;
  let awayGoals = 0;

  const matches: HeadToHeadMatch[] = [];

  for (
    const historicalMatch
    of historicalMatches
  ) {
    /*
     * Prisma sorgusunda null skorları
     * filtreledik. TypeScript bunu her
     * zaman otomatik daraltamayabilir.
     */
    if (
      historicalMatch.homeScore === null ||
      historicalMatch.awayScore === null
    ) {
      continue;
    }

    /*
     * Geçmiş maçta takımların saha
     * tarafları ters olabilir.
     *
     * Biz tüm istatistikleri HEDEF MAÇTAKİ
     * home/away takımlarına göre normalize
     * ediyoruz.
     */

    const targetHomeWasHistoricalHome =
      historicalMatch.homeTeamId ===
      targetMatch.homeTeamId;

    const targetHomeGoals =
      targetHomeWasHistoricalHome
        ? historicalMatch.homeScore
        : historicalMatch.awayScore;

    const targetAwayGoals =
      targetHomeWasHistoricalHome
        ? historicalMatch.awayScore
        : historicalMatch.homeScore;

    homeGoals += targetHomeGoals;
    awayGoals += targetAwayGoals;

    if (
      targetHomeGoals >
      targetAwayGoals
    ) {
      homeWins += 1;
    } else if (
      targetHomeGoals <
      targetAwayGoals
    ) {
      awayWins += 1;
    } else {
      draws += 1;
    }

    matches.push({
      matchId: historicalMatch.id,

      kickoffAt:
        historicalMatch.kickoffAt,

      homeTeamId:
        historicalMatch.homeTeamId,

      awayTeamId:
        historicalMatch.awayTeamId,

      homeScore:
        historicalMatch.homeScore,

      awayScore:
        historicalMatch.awayScore,
    });
  }

  const sampleSize =
    matches.length;

  const warnings: string[] = [];

  if (sampleSize === 0) {
    warnings.push(
      "Bu maç için geçmiş H2H karşılaşması bulunamadı.",
    );

    return {
      matchId:
        targetMatch.id,

      homeTeamId:
        targetMatch.homeTeamId,

      awayTeamId:
        targetMatch.awayTeamId,

      sampleSize: 0,

      homeWins: 0,
      draws: 0,
      awayWins: 0,

      homeWinRate: 0,
      drawRate: 0,
      awayWinRate: 0,

      homeGoalsPerGame: 0,
      awayGoalsPerGame: 0,
      totalGoalsPerGame: 0,

      matches: [],

      warnings,
    };
  }

  if (sampleSize < 3) {
    warnings.push(
      `H2H örnek sayısı düşük: ${sampleSize}. Sonuç dikkatli kullanılmalıdır.`,
    );
  }

  const homeWinRate =
    round(
      (homeWins / sampleSize) * 100,
    );

  const drawRate =
    round(
      (draws / sampleSize) * 100,
    );

  const awayWinRate =
    round(
      (awayWins / sampleSize) * 100,
    );

  const homeGoalsPerGame =
    round(
      homeGoals / sampleSize,
    );

  const awayGoalsPerGame =
    round(
      awayGoals / sampleSize,
    );

  const totalGoalsPerGame =
    round(
      (homeGoals + awayGoals) /
        sampleSize,
    );

  return {
    matchId:
      targetMatch.id,

    homeTeamId:
      targetMatch.homeTeamId,

    awayTeamId:
      targetMatch.awayTeamId,

    sampleSize,

    homeWins,
    draws,
    awayWins,

    homeWinRate,
    drawRate,
    awayWinRate,

    homeGoalsPerGame,
    awayGoalsPerGame,
    totalGoalsPerGame,

    matches,

    warnings,
  };
}