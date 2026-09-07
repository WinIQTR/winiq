import {
  prisma,
} from "@/lib/prisma";

import {
  calculatePlayerImpact,
} from "./calculate-player-impact";

export const PLAYER_IMPACT_MODEL_VERSION =
  "player-impact-v1";

export async function savePlayerImpact(
  options: {
    playerId: number;
    seasonId: number;
    teamId: number;
    beforeDate: Date;
    matchId: number;
  },
) {
  const {
    playerId,
    seasonId,
    teamId,
    beforeDate,
    matchId,
  } = options;

  const impact =
    await calculatePlayerImpact({
      playerId,
      seasonId,
      teamId,
      beforeDate,
      matchId,
    });

  const saved =
    await prisma.playerImpactScore.upsert({
      where: {
        playerId_matchId_modelVersion: {
          playerId,
          matchId,

          modelVersion:
            PLAYER_IMPACT_MODEL_VERSION,
        },
      },

      update: {
        seasonId,
        teamId,

        formScore:
          impact.scores.form,

        qualityScore:
          impact.scores.quality,

        fitnessScore:
          impact.scores.fitness,

        tacticalFitScore:
          impact.scores.tacticalFit,

        importanceScore:
          impact.scores.importance,

        marketValueScore:
          impact.scores.marketValue,

        overallImpactScore:
          impact.scores.overall,

        dataQualityScore:
          impact.dataQualityScore,

        calculatedAt:
          beforeDate,
      },

      create: {
        playerId,
        matchId,
        seasonId,
        teamId,

        formScore:
          impact.scores.form,

        qualityScore:
          impact.scores.quality,

        fitnessScore:
          impact.scores.fitness,

        tacticalFitScore:
          impact.scores.tacticalFit,

        importanceScore:
          impact.scores.importance,

        marketValueScore:
          impact.scores.marketValue,

        overallImpactScore:
          impact.scores.overall,

        dataQualityScore:
          impact.dataQualityScore,

        modelVersion:
          PLAYER_IMPACT_MODEL_VERSION,

        calculatedAt:
          beforeDate,
      },
    });

  return {
    impact,
    saved,
  };
}