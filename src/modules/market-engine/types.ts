export type MarketCategory =
  | "MATCH_RESULT"
  | "DOUBLE_CHANCE"
  | "DRAW_NO_BET"
  | "TOTAL_GOALS"
  | "TEAM_GOALS"
  | "BTTS"
  | "CLEAN_SHEET"
  | "WIN_TO_NIL"
  | "ODD_EVEN"
  | "CORRECT_SCORE"
  | "ASIAN_HANDICAP"
  | "CARDS"
  | "CORNERS"
  | "OFFSIDES"
  | "SHOTS"
  | "HALF_TIME_RESULT"
  | "HALF_TIME_FULL_TIME"
  | "PLAYER_GOALS"
  | "COMBINED";

export type MarketSelection = {
  key: string;

  category:
    MarketCategory;

  market:
    string;

  selection:
    string;

  probability:
    number;

  fairOdds:
    number | null;
};

export type MarketEngineResult = {
  matchId: number;

  selections:
    MarketSelection[];

  topSelections:
    MarketSelection[];

  model: {
    name: string;
    version: string;
  };

  warnings:
    string[];
};
