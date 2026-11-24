"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import type { MemberMarketFamilyPick } from "@/lib/member-market-family";

import styles from "./member-market-family-tabs.module.css";

export type { MemberMarketFamilyPick };

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
