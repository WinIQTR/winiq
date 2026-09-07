import {
  calculateSquadStrength,
} from "./calculate-squad-strength";

import type {
  SquadStrengthFeatureKey,
} from "./feature-definitions";

export type GeneratedSquadFeature = {
  key: SquadStrengthFeatureKey;
  rawValue: number;
  dataQualityScore: number;
};

export type GenerateSquadFeaturesOptions = {
  matchId: number;
  teamId: number;
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

export async function generateSquadFeatures(
  options: GenerateSquadFeaturesOptions,
): Promise<GeneratedSquadFeature[]> {
  const squad =
    await calculateSquadStrength({
      matchId:
        options.matchId,

      teamId:
        options.teamId,
    });

  const quality =
    round(
      clamp(
        squad.dataQualityScore,
        0,
        100,
      ),
    );

  const values: Record<
    SquadStrengthFeatureKey,
    number
  > = {
    squad_strength:
      squad.scores.overallSquad,

    starting_eleven_strength:
      squad.scores.startingEleven,

    bench_strength:
      squad.scores.bench,

    goalkeeper_strength:
      squad.scores.goalkeeper,

    defence_strength:
      squad.scores.defence,

    midfield_strength:
      squad.scores.midfield,

    attack_strength:
      squad.scores.attack,

    squad_depth:
      squad.scores.squadDepth,

    lineup_certainty:
      squad.scores.lineupCertainty,
  };

  return Object.entries(
    values,
  ).map(
    ([
      key,
      rawValue,
    ]) => ({
      key:
        key as SquadStrengthFeatureKey,

      rawValue:
        round(
          clamp(
            rawValue,
            0,
            100,
          ),
        ),

      dataQualityScore:
        quality,
    }),
  );
}