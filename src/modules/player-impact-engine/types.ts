export type PlayerImpactResult = {
  player: {
    id: number;
    name: string;
    teamId: number | null;
    teamName: string | null;
    position: string;
  };

  match: {
    id: number;
    kickoffAt: Date;
  } | null;

  seasonId: number;
  teamId: number;

  scores: {
    form: number;
    quality: number;
    fitness: number;
    tacticalFit: number;
    importance: number;
    marketValue: number;

    overall: number;
  };

  dataQualityScore: number;

  components: {
    recentRating: number | null;
    seasonRating: number | null;

    appearances: number;
    starts: number;
    minutes: number;

    goals: number;
    assists: number;

    marketValue: number | null;
  };

  warnings: string[];
};