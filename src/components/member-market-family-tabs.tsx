"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";

import styles from "./member-market-family-tabs.module.css";

export type MemberMarketFamilyPick = {
  key: string;
  family: "1x2" | "ou" | "btts" | "other";
  market: string;
  selection: string;
  probability?: number | null;
  fairOdds?: number | null;
};

export function MemberMarketFamilyTabs({
  picks,
}: {
  picks: MemberMarketFamilyPick[];
}) {
  const { t } = useLanguage();
  const [family, setFamily] = useState<"1x2" | "ou" | "btts" | "all">("all");

  const filtered = useMemo(() => {
    if (family === "all") return picks;
    return picks.filter((pick) => pick.family === family);
  }, [picks, family]);

  if (!picks.length) return null;

  return (
    <section className={styles.wrap} aria-label={t("Market family")}>
      <div className={styles.tabs} role="tablist">
        {(
          [
            ["all", t("All markets")],
            ["1x2", "1X2"],
            ["ou", t("Over / Under")],
            ["btts", "BTTS"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={family === key}
            data-active={family === key}
            onClick={() => setFamily(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className={styles.list}>
        {filtered.map((pick) => (
          <li key={pick.key}>
            <strong>
              {pick.market} · {pick.selection}
            </strong>
            <span>
              {pick.probability != null ? `%${pick.probability.toFixed(0)}` : "—"}
              {pick.fairOdds != null ? ` · ${pick.fairOdds.toFixed(2)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function classifyMarketFamily(
  market: string,
  selection: string,
  key = "",
): MemberMarketFamilyPick["family"] {
  const hay = `${market} ${selection} ${key}`.toLowerCase();
  if (/btts|both teams|karşılıklı/.test(hay)) return "btts";
  if (/over|under|üst|alt|o\/u|goals/.test(hay)) return "ou";
  if (/1x2|match result|home|away|draw|beraber|ms|maç sonucu/.test(hay)) {
    return "1x2";
  }
  return "other";
}
