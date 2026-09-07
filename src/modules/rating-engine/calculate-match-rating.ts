import { prisma } from "@/lib/prisma";

import { calculateTeamRating } from "./calculate-team-rating";

import type {
  MatchRatingEdge,
  MatchRatingResult,
} from "./types";

function round(
  value: number,
  decimals = 2,
): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function determineRatingEdge(options: {
  ratingDifference: number | null;
  confidenceScore: number;
}): MatchRatingEdge {
  const {
    ratingDifference,
    confidenceScore,
  } = options;

  if (
    ratingDifference === null ||
    confidenceScore < 30
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (ratingDifference >= 15) {
    return "STRONG_HOME";
  }

  if (ratingDifference >= 7) {
    return "HOME";
  }

  if (ratingDifference <= -15) {
    return "STRONG_AWAY";
  }

  if (ratingDifference <= -7) {
    return "AWAY";
  }

  return "BALANCED";
}

export async function calculateMatchRating(
  matchId: number,
): Promise<MatchRatingResult> {
  if (
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    throw new Error(
      "matchId pozitif bir tam sayı olmalıdır.",
    );
  }

  const match = await prisma.match.findUnique({
    where: {
      id: matchId,
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!match) {
    throw new Error(
      `${matchId} ID değerine sahip maç bulunamadı.`,
    );
  }

  const [home, away] =
    await Promise.all([
      calculateTeamRating({
        matchId: match.id,
        teamId: match.homeTeamId,
      }),

      calculateTeamRating({
        matchId: match.id,
        teamId: match.awayTeamId,
      }),
    ]);

  /*
   * İlk sürüm ev sahibi avantajı eklemiyor.
   * Bunu backtest sonucuna göre ayrı bir parametre
   * olarak sonraki aşamada ekleyeceğiz.
   */
  const ratingDifference =
    home.overall !== null &&
    away.overall !== null
      ? round(
          home.overall -
            away.overall,
        )
      : null;

  const combinedConfidenceScore =
    round(
      Math.min(
        home.confidenceScore,
        away.confidenceScore,
      ),
    );

  const edge = determineRatingEdge({
    ratingDifference,
    confidenceScore:
      combinedConfidenceScore,
  });

  return {
    match: {
      id: match.id,
      apiId: match.apiId,
      kickoffAt: match.kickoffAt,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      actualHomeScore:
        match.homeScore,
      actualAwayScore:
        match.awayScore,
    },

    home,
    away,

    ratingDifference,
    combinedConfidenceScore,
    edge,
  };
}