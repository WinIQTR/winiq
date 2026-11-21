/**
 * Double-chance odds from two mutually exclusive prices: 1 / (1/a + 1/b).
 */

import type { TrackPick } from "@/modules/track-record/types";

export function combineDoubleChanceOdds(a: number, b: number): number | null {
  if (!(a > 1) || !(b > 1)) return null;
  const implied = 1 / a + 1 / b;
  if (!(implied > 0) || !(implied < 1)) return null;
  return 1 / implied;
}

export function doubleChanceLegs(
  pick: TrackPick,
): Array<"1" | "X" | "2"> | null {
  if (pick === "1" || pick === "X" || pick === "2") return [pick];
  if (pick === "1X") return ["1", "X"];
  if (pick === "12") return ["1", "2"];
  if (pick === "X2") return ["X", "2"];
  return null;
}

export function oddsForPick(
  pick: TrackPick,
  prices: { home: number; draw: number; away: number },
): number | null {
  const legs = doubleChanceLegs(pick);
  if (!legs) return null;
  const map = { "1": prices.home, X: prices.draw, "2": prices.away } as const;
  if (legs.length === 1) {
    const odds = map[legs[0]!];
    return odds > 1 ? odds : null;
  }
  return combineDoubleChanceOdds(map[legs[0]!], map[legs[1]!]);
}

export function doubleChanceWins(
  pick: TrackPick,
  result: "1" | "X" | "2",
): boolean {
  const legs = doubleChanceLegs(pick);
  if (!legs) return false;
  return legs.includes(result);
}
