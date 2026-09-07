export type ApiOddsValue = {
  value: string;
  odd: string;
};

export type ApiOddsBet = {
  id: number;
  name: string;
  values: ApiOddsValue[];
};

export type ApiOddsBookmaker = {
  id: number;
  name: string;
  bets: ApiOddsBet[];
};

export type ApiOddsItem = {
  league: {
    id: number;
    name: string;
    country: string | null;
    season: number;
  };

  fixture: {
    id: number;
    timezone: string;
    date: string;
    timestamp: number;
  };

  update: string;

  bookmakers: ApiOddsBookmaker[];
};

export type ApiFootballOddsResponse = {
  get: string;

  parameters:
    Record<string, string>;

  errors:
    Record<string, string>;

  results: number;

  paging: {
    current: number;
    total: number;
  };

  response: ApiOddsItem[];
};

export type SupportedOddsMarketFamily =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "TOTAL_GOALS"
  | "BTTS"
  | "DRAW_NO_BET"
  | "HOME_TEAM_GOALS"
  | "AWAY_TEAM_GOALS";

export type NormalizedOddsSelection = {
  selectionKey: string;
  selectionName: string;

  decimalOdds: number;

  impliedProbability: number;

  normalizedProbability:
    number | null;

  line:
    number | null;
};

export type NormalizedOddsMarket = {
  apiBetId: number;

  marketKey: string;
  marketName: string;

  marketFamily:
    SupportedOddsMarketFamily;

  selections:
    NormalizedOddsSelection[];
};

export type ImportedOddsSummary = {
  matchId: number;
  fixtureApiId: number;

  homeTeam: string;
  awayTeam: string;

  bookmakerCount: number;

  snapshotCount: number;
  marketCount: number;
  selectionCount: number;

  skippedBookmakerCount: number;
  skippedMarketCount: number;
};