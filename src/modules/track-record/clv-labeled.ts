/**
 * Explicit raw vs de-vigged CLV labeling (TipsAudit caveat).
 */

export type LabeledClv = {
  /** (oddsTaken / closingOdds - 1) * 100 — margin included in both. */
  rawClvPct: number | null;
  /**
   * Fair-edge delta using model/fair probability:
   * (p*oddsTaken - 1) - (p*closingOdds - 1), as percent points on EV scale * 100.
   */
  deVigClvPct: number | null;
  beatClosing: boolean | null;
};

export function computeLabeledClv(options: {
  oddsTaken: number;
  closingOdds: number | null | undefined;
  /** Fair probability 0–1 of the selection (optional for de-vig CLV). */
  fairProbability?: number | null;
}): LabeledClv {
  const closing = options.closingOdds;
  if (
    !(options.oddsTaken > 1) ||
    closing == null ||
    !Number.isFinite(closing) ||
    !(closing > 1)
  ) {
    return { rawClvPct: null, deVigClvPct: null, beatClosing: null };
  }
  const rawClvPct = (options.oddsTaken / closing - 1) * 100;
  const p = options.fairProbability;
  const deVigClvPct =
    p != null && p > 0 && p < 1
      ? (p * options.oddsTaken - p * closing) * 100
      : null;
  return {
    rawClvPct,
    deVigClvPct,
    beatClosing: options.oddsTaken > closing,
  };
}

export function summarizeLabeledClv(
  rows: readonly LabeledClv[],
): {
  samples: number;
  meanRawClvPct: number | null;
  meanDeVigClvPct: number | null;
  beatClosingPct: number | null;
} {
  const withRaw = rows.filter((row) => row.rawClvPct !== null);
  if (withRaw.length === 0) {
    return {
      samples: 0,
      meanRawClvPct: null,
      meanDeVigClvPct: null,
      beatClosingPct: null,
    };
  }
  const meanRawClvPct =
    withRaw.reduce((total, row) => total + (row.rawClvPct as number), 0) /
    withRaw.length;
  const withDeVig = withRaw.filter((row) => row.deVigClvPct !== null);
  const meanDeVigClvPct =
    withDeVig.length > 0
      ? withDeVig.reduce(
          (total, row) => total + (row.deVigClvPct as number),
          0,
        ) / withDeVig.length
      : null;
  const beat = withRaw.filter((row) => row.beatClosing).length;
  return {
    samples: withRaw.length,
    meanRawClvPct,
    meanDeVigClvPct,
    beatClosingPct: (beat / withRaw.length) * 100,
  };
}
