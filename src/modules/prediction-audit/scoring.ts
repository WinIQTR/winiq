import type { OneXTwoResult } from "@/modules/prediction-audit/types";

export function multiClassBrier(
  pHome: number,
  pDraw: number,
  pAway: number,
  result: OneXTwoResult,
): number {
  const yHome = result === "1" ? 1 : 0;
  const yDraw = result === "X" ? 1 : 0;
  const yAway = result === "2" ? 1 : 0;
  return (
    (yHome - pHome) ** 2 + (yDraw - pDraw) ** 2 + (yAway - pAway) ** 2
  );
}

export function pickProbability(
  pick: OneXTwoResult,
  pHome: number,
  pDraw: number,
  pAway: number,
): number {
  if (pick === "1") return pHome;
  if (pick === "X") return pDraw;
  return pAway;
}

export function resultFromScores(
  homeScore: number,
  awayScore: number,
): OneXTwoResult {
  if (homeScore > awayScore) return "1";
  if (homeScore < awayScore) return "2";
  return "X";
}
