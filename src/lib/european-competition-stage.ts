export type EuropeanCompetitionStage = "LEAGUE" | "QUALIFYING" | "PLAYOFF" | "KNOCKOUT" | "UNKNOWN";

export function classifyEuropeanRound(round: string | null | undefined): EuropeanCompetitionStage {
  const value = (round ?? "").trim().toLocaleLowerCase("en-US");
  if (!value) return "UNKNOWN";
  if (/(league stage|league phase|regular season)/.test(value)) return "LEAGUE";
  if (/(qualifying|qualification|preliminary)/.test(value)) return "QUALIFYING";
  if (/(play-off|playoff|play off)/.test(value)) return "PLAYOFF";
  if (/(round of 16|round of 8|quarter|semi|final|knockout)/.test(value)) return "KNOCKOUT";
  return "UNKNOWN";
}

export const EUROPEAN_STAGE_LABELS: Record<EuropeanCompetitionStage, string> = {
  LEAGUE: "Lig Aşaması",
  QUALIFYING: "Eleme Turları",
  PLAYOFF: "Play-off",
  KNOCKOUT: "Son 16 ve Sonrası",
  UNKNOWN: "Diğer Aşama",
};
