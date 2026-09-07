export type PlayerFormTrend =
  | "STRONG_UP"
  | "UP"
  | "STABLE"
  | "DOWN"
  | "STRONG_DOWN"
  | "INSUFFICIENT_DATA";

export type PlayerRecentMatch = {
  matchId: number;

  kickoffAt: Date;

  opponent: string;

  homeAway:
    | "HOME"
    | "AWAY";

  minutes: number;

  starter: boolean;

  rating: number;

  goals: number;

  assists: number;
};

export type PlayerFormResult = {
  player: {
    id: number;
    name: string;

    teamId: number | null;
    teamName: string | null;

    position: string;
  };

  beforeDate: Date;

  samples: {
    totalRatedMatches: number;

    last1: number | null;
    last3: number | null;
    last5: number | null;
    last10: number | null;

    previous3: number | null;

    weightedRecentRating:
      number | null;
  };

  production: {
    last5Minutes: number;
    last5Starts: number;

    last5Goals: number;
    last5Assists: number;
  };

  trend: {
    type: PlayerFormTrend;

    change: number | null;

    description: string;
  };

  formScore: number | null;

  dataQualityScore: number;

  recentMatches:
    PlayerRecentMatch[];

  warnings: string[];
};