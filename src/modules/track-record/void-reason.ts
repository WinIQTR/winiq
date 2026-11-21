/**
 * VOID taxonomy — voids are not losses and are excluded from rates/CLV.
 */

import type { VoidReason } from "@/modules/track-record/types";

export const VOID_REASONS: readonly VoidReason[] = [
  "postponed",
  "cancelled",
  "abandoned",
  "no_result",
  "teams_reversed_unusable",
  "other",
] as const;

export function isVoidRow(row: {
  voidReason?: VoidReason | null;
  result?: string | null;
}): boolean {
  if (row.voidReason) return true;
  return row.result === null || row.result === undefined || row.result === "";
}

/** Rows that may enter hit-rate / CLV / ROI denominators. */
export function filterScoreableRows<T extends {
  voidReason?: VoidReason | null;
  result?: string | null;
}>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isVoidRow(row) && row.result);
}

export function voidReasonFromMatchStatus(
  status: string | null | undefined,
): VoidReason | null {
  const value = (status ?? "").toUpperCase();
  if (value === "POSTPONED") return "postponed";
  if (value === "CANCELLED" || value === "CANCELED") return "cancelled";
  if (value === "ABANDONED") return "abandoned";
  return null;
}
