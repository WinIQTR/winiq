/**
 * Value-flag commitment: sha256(preimage), reveal after kick-off.
 */

import { createHash, randomBytes } from "node:crypto";

import type { ValueFlag, ValueOrigin } from "@/modules/track-record/types";

export type ValuePreimageParts = {
  matchId: string;
  selection: "1" | "X" | "2" | "home" | "draw" | "away";
  odds: number;
  bookmaker: string;
  fairOdds: number;
  detectedAt: Date;
  salt?: string;
};

export function normalizeSelection(
  selection: ValuePreimageParts["selection"],
): "home" | "draw" | "away" {
  if (selection === "1" || selection === "home") return "home";
  if (selection === "X" || selection === "draw") return "draw";
  return "away";
}

export function buildValuePreimage(parts: ValuePreimageParts): string {
  const salt = parts.salt ?? randomBytes(16).toString("hex");
  const selection = normalizeSelection(parts.selection);
  return [
    parts.matchId,
    selection,
    parts.odds.toFixed(3),
    parts.bookmaker,
    parts.fairOdds.toFixed(3),
    parts.detectedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    salt,
  ].join("|");
}

export function commitValuePreimage(preimage: string): string {
  return createHash("sha256").update(preimage).digest("hex");
}

export function verifyValueCommitment(
  commitment: string,
  preimage: string,
): boolean {
  return commitValuePreimage(preimage) === commitment;
}

export function sealValueFlag(options: {
  matchId: string;
  selection: "1" | "X" | "2";
  bookmaker: string;
  oddsTaken: number;
  fairOdds: number;
  closingOdds?: number | null;
  origin: ValueOrigin;
  recordedAt: Date;
  kickoffAt: Date;
  salt?: string;
  realizableOdds?: number | null;
}): ValueFlag & { preimage: string } {
  const preimage = buildValuePreimage({
    matchId: options.matchId,
    selection: options.selection,
    odds: options.oddsTaken,
    bookmaker: options.bookmaker,
    fairOdds: options.fairOdds,
    detectedAt: options.recordedAt,
    salt: options.salt,
  });
  const commitment = commitValuePreimage(preimage);
  const realizableOdds = options.realizableOdds ?? null;
  const realizableClvPct =
    realizableOdds != null &&
    options.closingOdds != null &&
    options.closingOdds > 1
      ? (realizableOdds / options.closingOdds - 1) * 100
      : null;
  return {
    selection: options.selection,
    bookmaker: options.bookmaker,
    oddsTaken: options.oddsTaken,
    fairOdds: options.fairOdds,
    closingOdds: options.closingOdds ?? null,
    origin: options.origin,
    recordedAt: options.recordedAt,
    sealedBeforeKickoff: options.recordedAt.getTime() < options.kickoffAt.getTime(),
    commitment,
    preimage,
    realizableOdds,
    realizableClvPct,
  };
}

/**
 * First quote within `windowMinutes` after flag (same book) → realizable CLV.
 */
export function pickRealizableOdds(
  quotes: readonly { at: Date; odds: number; bookmaker: string }[],
  options: {
    bookmaker: string;
    flaggedAt: Date;
    kickoffAt: Date;
    windowMinutes?: number;
  },
): number | null {
  const windowMs = (options.windowMinutes ?? 60) * 60_000;
  const end = Math.min(
    options.flaggedAt.getTime() + windowMs,
    options.kickoffAt.getTime(),
  );
  const candidates = quotes
    .filter(
      (quote) =>
        quote.bookmaker === options.bookmaker &&
        quote.at.getTime() >= options.flaggedAt.getTime() &&
        quote.at.getTime() <= end &&
        quote.odds > 1,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0]?.odds ?? null;
}
