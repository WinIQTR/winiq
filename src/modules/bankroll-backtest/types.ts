export type BacktestBetOutcome = "WON" | "LOST" | "VOID" | "SKIP";

export type BacktestBetInput = {
  id: string;
  date: Date;
  /** Slot key for simultaneous settlement (defaults to Istanbul date). */
  slotKey?: string;
  odds: number;
  /** Model probability 0–1 of the selected outcome. */
  modelProbability: number;
  /** Optional closing / reference odds for CLV. */
  closingOdds?: number | null;
  result: Exclude<BacktestBetOutcome, "SKIP">;
  /** Advisory ranking score (higher = preferred). */
  edge?: number;
  marketKey?: string;
  leagueKey?: string;
};

export type SettledBacktestBet = BacktestBetInput & {
  stake: number;
  profit: number;
  bankrollBefore: number;
  bankrollAfter: number;
  skipped: boolean;
  skipReason: string | null;
  expectedProfit: number;
};

export type BankrollPathPoint = {
  index: number;
  date: Date;
  bankroll: number;
  drawdownPct: number;
  stake: number;
  profit: number;
  /** Cumulative stake turnover along the path. */
  cumulativeTurnover?: number;
};

export type BacktestMetrics = {
  bets: number;
  opportunities: number;
  betFrequencyPct: number;
  winRatePct: number | null;
  totalProfit: number;
  expectedProfit: number;
  realizedVsExpected: number;
  yieldPct: number | null;
  expectedYieldPct: number | null;
  roiPct: number;
  cagrPct: number | null;
  maxDrawdownPct: number;
  maxDrawdownDurationBets: number;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  averageOdds: number | null;
  averageStake: number;
  clvPct: number | null;
  clvNoVigPct: number | null;
  beatClosingPct: number | null;
  bankrollFinal: number;
  bankrollPeak: number;
  bankrollValley: number;
};

export type StressTestRow = {
  haircut: number;
  metrics: BacktestMetrics;
};
