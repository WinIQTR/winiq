import { MatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { generateMatchFeatures } from "./generate-match-features";

export type GenerateSeasonFeaturesResult = {
  leagueApiId: number;
  seasonYear: number;
  matchesFound: number;
  matchesProcessed: number;
  matchesFailed: number;
  featureValuesCreated: number;
  featureValuesUpdated: number;
  missingValues: number;
  failures: Array<{
    matchId: number;
    message: string;
  }>;
};

export async function generateSeasonFeatures(options: {
  leagueApiId: number;
  seasonYear: number;
}): Promise<GenerateSeasonFeaturesResult> {
  const { leagueApiId, seasonYear } = options;

  if (!Number.isInteger(leagueApiId) || leagueApiId <= 0) {
    throw new Error("leagueApiId pozitif bir tam sayı olmalıdır.");
  }

  if (
    !Number.isInteger(seasonYear) ||
    seasonYear < 2000 ||
    seasonYear > 2100
  ) {
    throw new Error("seasonYear geçerli bir yıl olmalıdır.");
  }

  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.FINISHED,
      season: {
        year: seasonYear,
        league: {
          apiId: leagueApiId,
        },
      },
    },
    orderBy: {
      kickoffAt: "asc",
    },
    select: {
      id: true,
    },
  });

  let matchesProcessed = 0;
  let matchesFailed = 0;
  let featureValuesCreated = 0;
  let featureValuesUpdated = 0;
  let missingValues = 0;

  const failures: GenerateSeasonFeaturesResult["failures"] = [];

  for (const match of matches) {
    try {
      const result = await generateMatchFeatures(match.id);

      matchesProcessed += 1;

      featureValuesCreated +=
        result.home.createdCount +
        result.away.createdCount;

      featureValuesUpdated +=
        result.home.updatedCount +
        result.away.updatedCount;

      missingValues +=
        result.home.missingCount +
        result.away.missingCount;
    } catch (error) {
      matchesFailed += 1;

      failures.push({
        matchId: match.id,
        message:
          error instanceof Error
            ? error.message
            : "Bilinmeyen feature üretim hatası.",
      });
    }
  }

  return {
    leagueApiId,
    seasonYear,
    matchesFound: matches.length,
    matchesProcessed,
    matchesFailed,
    featureValuesCreated,
    featureValuesUpdated,
    missingValues,
    failures,
  };
}