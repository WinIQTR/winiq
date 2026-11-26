export type MatchLiveBoard = {
  matchId: number;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  statusShort: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type MatchEventRow = {
  elapsed: number;
  extra: number | null;
  type: string;
  detail: string | null;
  playerName: string | null;
  assistName: string | null;
  teamId: number | null;
};

export type StandingRow = {
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
  teamName: string;
  teamLogo: string | null;
  teamId: number;
};

export function formatMatchScore(board: MatchLiveBoard | null | undefined): string | null {
  if (!board) return null;
  if (board.homeScore == null || board.awayScore == null) return null;
  return `${board.homeScore}–${board.awayScore}`;
}

export function matchStatusLabel(
  board: MatchLiveBoard | null | undefined,
  locale: "tr" | "en" = "tr",
): string | null {
  if (!board) return null;
  if (board.status === "LIVE") return locale === "tr" ? "CANLI" : "LIVE";
  if (board.status === "FINISHED") return locale === "tr" ? "MS" : "FT";
  if (board.status === "POSTPONED") return locale === "tr" ? "ERT" : "PPD";
  if (board.status === "CANCELLED") return locale === "tr" ? "İPT" : "CANC";
  if (board.statusShort && board.statusShort !== "NS") return board.statusShort;
  return null;
}
