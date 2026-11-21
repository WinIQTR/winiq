export type VoidReason =
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "no_result"
  | "teams_reversed_unusable"
  | "other";

export type ValueOrigin = "live" | "replay";

export type BookmakerKind = "soft" | "exchange" | "etalon";

export type TrackPick = "1" | "X" | "2" | "1X" | "12" | "X2";

export type TrackRecordRow = {
  id: string;
  matchId: string;
  league: string;
  home: string;
  away: string;
  kickoffAt: Date;
  loggedAt: Date;
  pick: TrackPick;
  /** Model probability of the pick (0–1). */
  probability: number;
  /** Odds taken / logged for the pick. */
  oddsTaken: number;
  /** Sharp (e.g. Pinnacle) price at log / first pre-KO fill. */
  pinOpen?: number | null;
  /** Sharp closing price. */
  pinClose?: number | null;
  /** Best soft/exchange price seen for the selection. */
  bestSoft?: number | null;
  bestSoftBook?: string | null;
  fairProbHome?: number | null;
  fairProbDraw?: number | null;
  fairProbAway?: number | null;
  result?: "1" | "X" | "2" | null;
  voidReason?: VoidReason | null;
  predictionWon?: boolean | null;
  loggedBeforeKickoff: boolean;
  teamsReversedAfterLogging?: boolean;
  recordHash?: string;
  value?: ValueFlag | null;
};

export type ValueFlag = {
  selection: "1" | "X" | "2";
  bookmaker: string;
  oddsTaken: number;
  fairOdds: number;
  closingOdds?: number | null;
  origin: ValueOrigin;
  recordedAt: Date;
  sealedBeforeKickoff: boolean;
  commitment: string;
  /** Revealed after kick-off. */
  preimage?: string | null;
  realizableOdds?: number | null;
  realizableClvPct?: number | null;
  won?: boolean | null;
  profitUnits?: number | null;
};
