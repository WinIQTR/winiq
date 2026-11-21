/**
 * Back + lay Kelly fractions (R1ch1k).
 */

/** Classic back Kelly: f* = (p*odds - 1) / (odds - 1). */
export function kellyBackFraction(probability: number, odds: number): number {
  if (!(probability > 0 && probability < 1) || !(odds > 1)) return 0;
  const edge = probability * odds - 1;
  if (edge <= 0) return 0;
  return edge / (odds - 1);
}

/**
 * Lay Kelly: risking liability L = stake*(odds-1).
 * f* = ((1-p)*odds - 1) / (odds - 1) when laying is +EV.
 */
export function kellyLayFraction(probability: number, odds: number): number {
  if (!(probability > 0 && probability < 1) || !(odds > 1)) return 0;
  const q = 1 - probability;
  const edge = q * odds - 1;
  if (edge <= 0) return 0;
  return edge / (odds - 1);
}

export function kellyBackStake(
  bankroll: number,
  probability: number,
  odds: number,
  fraction = 1,
): number {
  const f = kellyBackFraction(probability, odds) * Math.max(0, fraction);
  return Math.max(0, bankroll * f);
}

/** Returns { stake, liability } for a lay bet sized by Kelly. */
export function kellyLayStake(
  bankroll: number,
  probability: number,
  odds: number,
  fraction = 1,
): { stake: number; liability: number } {
  const f = kellyLayFraction(probability, odds) * Math.max(0, fraction);
  const liability = Math.max(0, bankroll * f);
  const stake = odds > 1 ? liability / (odds - 1) : 0;
  return { stake, liability };
}
