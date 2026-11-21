/**
 * Margin removal (de-vig) for mutually exclusive decimal odds.
 * Methods: normalized | power | shin (Reymes/football-match-prediction MIT).
 */

export type DevigMethod = "normalized" | "power" | "shin";

function assertValidOdds(odds: readonly number[]): number[] {
  const values = odds.map(Number);
  if (
    values.length === 0 ||
    values.some((odd) => !Number.isFinite(odd) || odd <= 1)
  ) {
    throw new Error(`invalid decimal odds for de-vig: ${JSON.stringify(odds)}`);
  }
  return values;
}

function implied(odds: readonly number[]): number[] {
  return assertValidOdds(odds).map((odd) => 1 / odd);
}

export function overround(odds: readonly number[]): number {
  return implied(odds).reduce((total, value) => total + value, 0) - 1;
}

export function devigNormalized(odds: readonly number[]): number[] {
  const imp = implied(odds);
  const sum = imp.reduce((total, value) => total + value, 0);
  return imp.map((value) => value / sum);
}

export function devigPower(
  odds: readonly number[],
  tol = 1e-10,
  maxIter = 200,
): number[] {
  const imp = implied(odds);
  let lo = 1e-6;
  let hi = 100;
  const f = (k: number) =>
    imp.reduce((total, value) => total + value ** k, 0) - 1;

  for (let i = 0; i < maxIter; i += 1) {
    const mid = 0.5 * (lo + hi);
    const val = f(mid);
    if (Math.abs(val) < tol) break;
    if (val > 0) lo = mid;
    else hi = mid;
  }

  const k = 0.5 * (lo + hi);
  const powered = imp.map((value) => value ** k);
  const sum = powered.reduce((total, value) => total + value, 0);
  return powered.map((value) => value / sum);
}

export function devigShin(
  odds: readonly number[],
  tol = 1e-10,
  maxIter = 200,
): number[] {
  const imp = implied(odds);
  const booksum = imp.reduce((total, value) => total + value, 0);
  if (imp.length < 2) return imp.map((value) => value / booksum);

  const probs = (z: number): number[] => {
    if (z <= 0) return imp.map((value) => value / booksum);
    return imp.map((value) => {
      const inner = z * z + (4 * (1 - z) * value * value) / booksum;
      return (Math.sqrt(inner) - z) / (2 * (1 - z));
    });
  };

  const g = (z: number) =>
    probs(z).reduce((total, value) => total + value, 0) - 1;

  let lo = 0;
  let hi = 0.999;
  if (g(hi) > 0) return imp.map((value) => value / booksum);

  for (let i = 0; i < maxIter; i += 1) {
    const mid = 0.5 * (lo + hi);
    const val = g(mid);
    if (Math.abs(val) < tol) break;
    if (val > 0) lo = mid;
    else hi = mid;
  }

  const z = 0.5 * (lo + hi);
  const result = probs(z);
  const sum = result.reduce((total, value) => total + value, 0);
  return result.map((value) => value / sum);
}

const METHODS: Record<DevigMethod, (odds: readonly number[]) => number[]> = {
  normalized: devigNormalized,
  power: devigPower,
  shin: devigShin,
};

export function devig(
  odds: readonly number[],
  method: DevigMethod = "shin",
): number[] {
  const runner = METHODS[method];
  if (!runner) {
    throw new Error(
      `unknown de-vig method ${method}; choose from normalized|power|shin`,
    );
  }
  return runner(odds);
}

export function compareDevigMethods(odds: readonly number[]): {
  overround: number;
  normalized: number[];
  power: number[];
  shin: number[];
} {
  return {
    overround: overround(odds),
    normalized: devigNormalized(odds),
    power: devigPower(odds),
    shin: devigShin(odds),
  };
}

/** Convert fair probabilities (0–1) to percentage points for WinIQ storage. */
export function toProbabilityPercents(probs: readonly number[]): number[] {
  return probs.map((value) => Math.round(value * 10_000) / 100);
}
