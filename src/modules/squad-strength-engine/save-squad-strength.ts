import {
  prisma,
} from "@/lib/prisma";

import {
  calculateSquadStrength,
} from "./calculate-squad-strength";

export const SQUAD_STRENGTH_MODEL_VERSION =
  "squad-strength-v1";

export async function saveSquadStrength(
  options: {
    matchId: number;
    teamId: number;
  },
) {
  const strength =
    await calculateSquadStrength(
      options,
    );

  const saved =
    await prisma.squadStrengthScore.upsert({
      where: {
        matchId_teamId_modelVersion: {
          matchId:
            options.matchId,

          teamId:
            options.teamId,

          modelVersion:
            SQUAD_STRENGTH_MODEL_VERSION,
        },
      },

      update: {
        startingElevenScore:
          strength.scores
            .startingEleven,

        benchScore:
          strength.scores
            .bench,

        goalkeeperScore:
          strength.scores
            .goalkeeper,

        defenceScore:
          strength.scores
            .defence,

        midfieldScore:
          strength.scores
            .midfield,

        attackScore:
          strength.scores
            .attack,

        missingPlayerPenalty:
          strength.scores
            .missingPlayerPenalty,

        squadDepthScore:
          strength.scores
            .squadDepth,

        overallSquadScore:
          strength.scores
            .overallSquad,

        lineupCertainty:
          strength.scores
            .lineupCertainty,

        calculatedAt:
          new Date(),
      },

      create: {
        matchId:
          options.matchId,

        teamId:
          options.teamId,

        startingElevenScore:
          strength.scores
            .startingEleven,

        benchScore:
          strength.scores
            .bench,

        goalkeeperScore:
          strength.scores
            .goalkeeper,

        defenceScore:
          strength.scores
            .defence,

        midfieldScore:
          strength.scores
            .midfield,

        attackScore:
          strength.scores
            .attack,

        missingPlayerPenalty:
          strength.scores
            .missingPlayerPenalty,

        squadDepthScore:
          strength.scores
            .squadDepth,

        overallSquadScore:
          strength.scores
            .overallSquad,

        lineupCertainty:
          strength.scores
            .lineupCertainty,

        modelVersion:
          SQUAD_STRENGTH_MODEL_VERSION,
      },
    });

  return {
    strength,
    saved,
  };
}