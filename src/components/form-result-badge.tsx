import type { FormResult } from "@/lib/member-match-insight";

const MARK: Record<FormResult, { tr: string; en: string }> = {
  W: { tr: "G", en: "W" },
  D: { tr: "B", en: "D" },
  L: { tr: "M", en: "L" },
};

/** Shared W/D/L form squares — styled by globals `.form-result-*`. */
export function FormResultBadge({
  results,
  locale = "tr",
  max = 5,
  fillMissing = false,
}: {
  results?: Array<FormResult | null | undefined> | null;
  locale?: "tr" | "en";
  max?: number;
  /** Pad to `max` with dashed empty squares when true. */
  fillMissing?: boolean;
}) {
  const slice = (results ?? [])
    .slice(0, max)
    .map((result) => result ?? null);
  const items: Array<FormResult | null> = fillMissing
    ? Array.from({ length: max }, (_, i) => slice[i] ?? null)
    : slice;

  if (!items.length) return null;

  return (
    <span className="form-result-badge">
      {items.map((result, index) => {
        if (!result) {
          return (
            <i className="form-result-missing" key={index} aria-hidden="true">
              —
            </i>
          );
        }
        const mark = locale === "en" ? MARK[result].en : MARK[result].tr;
        return (
          <i className="form-result-dot" data-result={result} key={index}>
            {mark}
          </i>
        );
      })}
    </span>
  );
}
