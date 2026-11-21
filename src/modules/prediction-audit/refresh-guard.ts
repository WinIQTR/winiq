/**
 * Refuse dataset writes that shrink too aggressively (open-data MAX_SHRINK).
 */

export const DEFAULT_MAX_SHRINK = 0.2;

export type ShrinkGuardResult =
  | { ok: true; previous: number; next: number; shrinkPct: number }
  | {
      ok: false;
      previous: number;
      next: number;
      shrinkPct: number;
      message: string;
    };

export function checkRefreshShrink(
  previousCount: number,
  nextCount: number,
  maxShrink = DEFAULT_MAX_SHRINK,
): ShrinkGuardResult {
  if (!(previousCount > 0) || !(nextCount >= 0)) {
    return {
      ok: true,
      previous: previousCount,
      next: nextCount,
      shrinkPct: 0,
    };
  }
  const shrinkPct =
    previousCount > 0 ? Math.max(0, (previousCount - nextCount) / previousCount) : 0;
  if (nextCount < previousCount * (1 - maxShrink)) {
    return {
      ok: false,
      previous: previousCount,
      next: nextCount,
      shrinkPct,
      message: `source has ${nextCount} rows, repository has ${previousCount}: refusing to shrink >${(maxShrink * 100).toFixed(0)}%`,
    };
  }
  return { ok: true, previous: previousCount, next: nextCount, shrinkPct };
}

export function assertRefreshShrink(
  previousCount: number,
  nextCount: number,
  maxShrink = DEFAULT_MAX_SHRINK,
): void {
  const result = checkRefreshShrink(previousCount, nextCount, maxShrink);
  if (!result.ok) throw new Error(result.message);
}
