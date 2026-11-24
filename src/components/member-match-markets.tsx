"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import type { BetMarketGroup } from "@/lib/bet-market-catalog";
import { probabilityTone } from "@/lib/probability-tone";

import styles from "./member-match-markets.module.css";

function marketCode(key: string, selection: string): string {
  const fromKey = key
    .replace(/^ms-/i, "MS")
    .replace(/^iy-/i, "İY")
    .replace(/^dc-/i, "CS")
    .replace(/-/g, "")
    .toUpperCase();
  if (fromKey.length > 0 && fromKey.length <= 10) return fromKey;
  const head = selection.split(/[•·|]/)[0]?.trim() ?? selection;
  return head.slice(0, 10).toUpperCase();
}

function selectionLabel(selection: string): string {
  const parts = selection.split(/[•·]/);
  if (parts.length > 1) return parts.slice(1).join("·").trim() || selection;
  return selection;
}

function IconTrophy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 5H5.5A2.5 2.5 0 0 0 8 7.5M16 5h2.5A2.5 2.5 0 0 1 16 7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10 14h4v2.2c0 1.2-.9 2.3-2 2.3s-2-1.1-2-2.3V14ZM9 21h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TAB_SHORT: Record<string, string> = {
  "Maç Sonucu": "1X2",
  "Match Result": "1X2",
  "Çifte Şans": "Çifte Şans",
  "Double Chance": "Double Chance",
  "İlk Yarı Sonucu": "İlk Yarı",
  "Half-Time Result": "1st Half",
  "Toplam Gol Alt / Üst": "Alt/Üst",
  "Total Goals Over / Under": "O/U",
  "Karşılıklı Gol": "KG",
  "Both Teams to Score": "BTTS",
  "Kesin Skor": "Skor",
  "Correct Score": "Score",
  "İlk Yarı / Maç Sonucu": "İY/MS",
  "Half-Time / Full-Time": "HT/FT",
};

export function MemberMatchMarkets({
  groups,
}: {
  groups: BetMarketGroup[];
}) {
  const { t } = useLanguage();
  const available = useMemo(
    () => groups.filter((group) => group.available && group.options.length > 0),
    [groups],
  );
  const [active, setActive] = useState<string>("all");

  const tabs = useMemo(() => {
    const preferred = available.slice(0, 8);
    return preferred.map((group) => ({
      id: String(group.number),
      label: TAB_SHORT[group.title] ?? group.title,
      title: group.title,
    }));
  }, [available]);

  const visible = useMemo(() => {
    if (active === "all") return available.slice(0, 6);
    return available.filter((group) => String(group.number) === active);
  }, [available, active]);

  if (!available.length) return null;

  return (
    <section className={styles.wrap} aria-label={t("Match prediction markets")}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{t("Match prediction markets")}</h2>
          <p className={styles.lead}>
            {t("Model probability (%) and fair odds for this match.")}
          </p>
        </div>
        <div className={styles.legend} aria-hidden>
          <span data-tone="high">{t("Favourite")}</span>
          <span data-tone="medium">{t("Medium")}</span>
          <span data-tone="low">{t("Low")}</span>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t("Market filters")}>
        <button
          type="button"
          role="tab"
          aria-selected={active === "all"}
          data-active={active === "all" ? "true" : undefined}
          onClick={() => setActive("all")}
        >
          {t("All")}
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            data-active={active === tab.id ? "true" : undefined}
            title={tab.title}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.groups}>
        {visible.map((group) => (
          <article className={styles.group} key={group.number}>
            <div className={styles.groupHead}>
              <span className={styles.groupIcon}>
                <IconTrophy />
              </span>
              <h3>{group.title}</h3>
            </div>
            <div className={styles.table}>
              <div className={styles.cols} aria-hidden>
                <span>{t("Market code")}</span>
                <span>{t("Selection")}</span>
                <span>{t("Model probability")}</span>
                <span>{t("Odds")}</span>
              </div>
              <ul className={styles.rows}>
                {group.options.slice(0, 8).map((option) => {
                  const pct = Math.max(0, Math.min(100, option.probability));
                  const tone = probabilityTone(pct);
                  return (
                    <li key={option.key} data-tone={tone}>
                      <span className={styles.code}>
                        {marketCode(option.key, option.selection)}
                      </span>
                      <strong className={styles.pick}>
                        {selectionLabel(option.selection)}
                      </strong>
                      <div className={styles.prob}>
                        <span className={styles.bar} aria-hidden>
                          <i style={{ width: `${Math.max(4, pct)}%` }} />
                        </span>
                        <b>%{pct.toFixed(0)}</b>
                      </div>
                      <span className={styles.odds}>{option.fairOdds.toFixed(2)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
