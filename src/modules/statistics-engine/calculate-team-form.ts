import {
  MatchStatus,
} from "@/generated/prisma/client";

import {
  prisma,
} from "@/lib/prisma";

type CompletedMatch = {
  id: number;
  kickoffAt: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
};

export type TeamFormResult = {
  teamId: number;
  beforeDate: Date;

  matchesUsed: number;

  points: number;
  pointsPerGame: number | null;

  goalsScored: number;
  goalsConceded: number;

  goalsScoredPerGame: number | null;
  goalsConcededPerGame: number | null;
  goalDifferencePerGame: number | null;

  wins: number;
  draws: number;
  losses: number;

  winRate: number | null;
  drawRate: number | null;
  lossRate: number | null;

  cleanSheets: number;
  cleanSheetRate: number | null;

  bttsMatches: number;
  bttsRate: number | null;

  over25Matches: number;
  over25Rate: number | null;

  lastMatchAt: Date | null;
  restDays: number | null;

  matchesInLast14Days: number;
};

function round(
  value: number,
  decimals = 2,
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor,
    ) /
    factor
  );
}

function calculateRate(
  count: number,
  total: number,
): number | null {
  if (
    total <=
    0
  ) {
    return null;
  }

  return round(
    (
      count /
      total
    ) *
      100,
  );
}

function calculatePoints(
  teamId: number,
  match: CompletedMatch,
): number {
  if (
    match.homeScore ===
      null ||
    match.awayScore ===
      null
  ) {
    return 0;
  }

  const isHome =
    match.homeTeamId ===
    teamId;

  const teamScore =
    isHome
      ? match.homeScore
      : match.awayScore;

  const opponentScore =
    isHome
      ? match.awayScore
      : match.homeScore;

  if (
    teamScore >
    opponentScore
  ) {
    return 3;
  }

  if (
    teamScore ===
    opponentScore
  ) {
    return 1;
  }

  return 0;
}

export async function calculateTeamForm(
  options: {
    teamId: number;
    beforeDate: Date;
    matchLimit?: number;
    venue?:
      | "ALL"
      | "HOME"
      | "AWAY";
  },
): Promise<TeamFormResult> {
  const {
    teamId,
    beforeDate,
    matchLimit = 5,
    venue = "ALL",
  } =
    options;

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

  if (
    !Number.isInteger(
      matchLimit,
    ) ||
    matchLimit <= 0 ||
    matchLimit > 50
  ) {
    throw new Error(
      "matchLimit 1 ile 50 arasında olmalıdır.",
    );
  }

  const teamCondition =
    venue === "HOME"
      ? {
          homeTeamId:
            teamId,
        }
      : venue === "AWAY"
        ? {
            awayTeamId:
              teamId,
          }
        : {
            OR: [
              {
                homeTeamId:
                  teamId,
              },
              {
                awayTeamId:
                  teamId,
              },
            ],
          };

  const matches =
    await prisma.match.findMany({
      where: {
        ...teamCondition,

        status:
          MatchStatus.FINISHED,

        kickoffAt: {
          lt:
            beforeDate,
        },

        homeScore: {
          not:
            null,
        },

        awayScore: {
          not:
            null,
        },
      },

      orderBy: {
        kickoffAt:
          "desc",
      },

      take:
        matchLimit,

      select: {
        id:
          true,

        kickoffAt:
          true,

        homeTeamId:
          true,

        awayTeamId:
          true,

        homeScore:
          true,

        awayScore:
          true,
      },
    });

  let points =
    0;

  let goalsScored =
    0;

  let goalsConceded =
    0;

  let wins =
    0;

  let draws =
    0;

  let losses =
    0;

  let cleanSheets =
    0;

  let bttsMatches =
    0;

  let over25Matches =
    0;

  for (
    const match
    of matches
  ) {
    const isHome =
      match.homeTeamId ===
      teamId;

    const teamScore =
      isHome
        ? match.homeScore
        : match.awayScore;

    const opponentScore =
      isHome
        ? match.awayScore
        : match.homeScore;

    if (
      teamScore ===
        null ||
      opponentScore ===
        null
    ) {
      continue;
    }

    const matchPoints =
      calculatePoints(
        teamId,
        match,
      );

    points +=
      matchPoints;

    goalsScored +=
      teamScore;

    goalsConceded +=
      opponentScore;

    if (
      matchPoints ===
      3
    ) {
      wins +=
        1;
    } else if (
      matchPoints ===
      1
    ) {
      draws +=
        1;
    } else {
      losses +=
        1;
    }

    if (
      opponentScore ===
      0
    ) {
      cleanSheets +=
        1;
    }

    if (
      teamScore >
        0 &&
      opponentScore >
        0
    ) {
      bttsMatches +=
        1;
    }

    if (
      teamScore +
        opponentScore >
      2
    ) {
      over25Matches +=
        1;
    }
  }

  const matchesUsed =
    matches.length;

  const lastMatchAt =
    matches[0]
      ?.kickoffAt ??
    null;

  const restDays =
    lastMatchAt
      ? Math.max(
          0,

          Math.floor(
            (
              beforeDate.getTime() -
              lastMatchAt.getTime()
            ) /
              (
                1000 *
                60 *
                60 *
                24
              ),
          ),
        )
      : null;

  const fourteenDaysBefore =
    new Date(
      beforeDate.getTime() -
        14 *
          24 *
          60 *
          60 *
          1000,
    );

  const matchesInLast14Days =
    await prisma.match.count({
      where: {
        OR: [
          {
            homeTeamId:
              teamId,
          },
          {
            awayTeamId:
              teamId,
          },
        ],

        status:
          MatchStatus.FINISHED,

        kickoffAt: {
          gte:
            fourteenDaysBefore,

          lt:
            beforeDate,
        },
      },
    });

  return {
    teamId,
    beforeDate,

    matchesUsed,

    points,

    pointsPerGame:
      matchesUsed >
      0
        ? round(
            points /
              matchesUsed,
          )
        : null,

    goalsScored,
    goalsConceded,

    goalsScoredPerGame:
      matchesUsed >
      0
        ? round(
            goalsScored /
              matchesUsed,
          )
        : null,

    goalsConcededPerGame:
      matchesUsed >
      0
        ? round(
            goalsConceded /
              matchesUsed,
          )
        : null,

    goalDifferencePerGame:
      matchesUsed >
      0
        ? round(
            (
              goalsScored -
              goalsConceded
            ) /
              matchesUsed,
          )
        : null,

    wins,
    draws,
    losses,

    winRate:
      calculateRate(
        wins,
        matchesUsed,
      ),

    drawRate:
      calculateRate(
        draws,
        matchesUsed,
      ),

    lossRate:
      calculateRate(
        losses,
        matchesUsed,
      ),

    cleanSheets,

    cleanSheetRate:
      calculateRate(
        cleanSheets,
        matchesUsed,
      ),

    bttsMatches,

    bttsRate:
      calculateRate(
        bttsMatches,
        matchesUsed,
      ),

    over25Matches,

    over25Rate:
      calculateRate(
        over25Matches,
        matchesUsed,
      ),

    lastMatchAt,
    restDays,

    matchesInLast14Days,
  };
}