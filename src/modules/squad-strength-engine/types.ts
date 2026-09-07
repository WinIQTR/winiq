export type SquadStrengthLineupMode =
  | "CONFIRMED"
  | "PREDICTED";

export type SquadStrengthResult = {
  match: {
    id: number;
    kickoffAt: Date;
  };

  team: {
    id: number;
    name: string;
  };

  lineupMode:
    SquadStrengthLineupMode;

  players: {
    total: number;
    starters: number;
    bench: number;
  };

  scores: {
    startingEleven: number;
    bench: number;

    goalkeeper: number;
    defence: number;
    midfield: number;
    attack: number;

    missingPlayerPenalty: number;

    squadDepth: number;

    overallSquad: number;

    lineupCertainty: number;
  };

  dataQualityScore: number;

  warnings: string[];
};