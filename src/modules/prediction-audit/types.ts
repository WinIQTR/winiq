/** Settled or pending 1X2-style prediction row for audit tooling. */

export type OneXTwoResult = "1" | "X" | "2";

export type SettledOneXTwoRow = {
  fixtureId: string;
  kickoffAt: Date;
  leagueKey: string;
  leagueName: string;
  country?: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  result: OneXTwoResult | null;
  pHome: number;
  pDraw: number;
  pAway: number;
  lambdaHome?: number | null;
  lambdaAway?: number | null;
  pick: OneXTwoResult;
  pickCorrect?: boolean | null;
  modelVersion: string;
  /** When the model wrote this pick. */
  pickWrittenAt?: Date | null;
  /** When WinIQ first observed this pick publicly. */
  firstSeenAt?: Date | null;
};

export type UpcomingPickRow = {
  fixtureId: string;
  kickoffAt: Date;
  leagueKey: string;
  homeTeam: string;
  awayTeam: string;
  pick: OneXTwoResult;
  pickWrittenAt: Date;
};
