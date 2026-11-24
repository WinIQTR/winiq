"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import type { BetMarketGroup } from "@/lib/bet-market-catalog";
import { probabilityTone } from "@/lib/probability-tone";

import styles from "./member-match-markets.module.css";

/** Preferred market order matching the mockup chips. */
const PREFERRED_NUMBERS = [1, 2, 3, 4, 5, 8];

type MarketMeta = {
  short: string;
  blurbTr: string;
  blurbEn: string;
  icon: "trophy" | "shield" | "clock" | "split" | "goals" | "btts";
};

const MARKET_META: Record<string, MarketMeta> = {
  "Maç Sonucu": {
    short: "1X2",
    blurbTr: "Maç sonucu (90 dakika).",
    blurbEn: "Full-time result (90 minutes).",
    icon: "trophy",
  },
  "Match Result": {
    short: "1X2",
    blurbTr: "Maç sonucu (90 dakika).",
    blurbEn: "Full-time result (90 minutes).",
    icon: "trophy",
  },
  "Çifte Şans": {
    short: "Çifte Şans",
    blurbTr: "İki sonuçtan biri.",
    blurbEn: "Two outcomes covered.",
    icon: "shield",
  },
  "Double Chance": {
    short: "Double Chance",
    blurbTr: "İki sonuçtan biri.",
    blurbEn: "Two outcomes covered.",
    icon: "shield",
  },
  "İlk Yarı Sonucu": {
    short: "İlk Yarı",
    blurbTr: "İlk 45 dakika sonucu.",
    blurbEn: "First-half result.",
    icon: "clock",
  },
  "Half-Time Result": {
    short: "1st Half",
    blurbTr: "İlk 45 dakika sonucu.",
    blurbEn: "First-half result.",
    icon: "clock",
  },
  "İlk Yarı / Maç Sonucu": {
    short: "İlk Yarı/Maç Sonucu",
    blurbTr: "Devre ve maç sonucu.",
    blurbEn: "Half-time / full-time.",
    icon: "split",
  },
  "Half-Time / Full-Time": {
    short: "HT/FT",
    blurbTr: "Devre ve maç sonucu.",
    blurbEn: "Half-time / full-time.",
    icon: "split",
  },
  "Toplam Gol Alt / Üst": {
    short: "Toplam Gol Alt/Üst",
    blurbTr: "Toplam gol çizgileri.",
    blurbEn: "Total goals lines.",
    icon: "goals",
  },
  "Total Goals Over / Under": {
    short: "Over/Under",
    blurbTr: "Toplam gol çizgileri.",
    blurbEn: "Total goals lines.",
    icon: "goals",
  },
  "Karşılıklı Gol": {
    short: "BTTS",
    blurbTr: "Karşılıklı gol var / yok.",
    blurbEn: "Both teams to score.",
    icon: "btts",
  },
  "Both Teams to Score": {
    short: "BTTS",
    blurbTr: "Karşılıklı gol var / yok.",
    blurbEn: "Both teams to score.",
    icon: "btts",
  },
};

function metaFor(title: string): MarketMeta {
  return (
    MARKET_META[title] ?? {
      short: title,
      blurbTr: "Model seçimleri.",
      blurbEn: "Model selections.",
      icon: "trophy" as const,
    }
  );
}

function marketCode(key: string, selection: string): string {
  if (/^ms-/i.test(key)) return key.replace(/^ms-/i, "MS").replace(/-/g, "").toUpperCase();
  if (/^iy-\d/i.test(key)) return key.replace(/^iy-/i, "İY").replace(/-/g, "").toUpperCase();
  if (/^dc-/i.test(key)) {
    const head = selection.split(/[•·]/)[0]?.trim() ?? selection;
    return head.replace(/\s+/g, "");
  }
  const head = selection.split(/[•·|]/)[0]?.trim() ?? selection;
  if (head.length <= 12) return head;
  return key.replace(/-/g, "").toUpperCase().slice(0, 10);
}

function selectionLabel(selection: string): string {
  const parts = selection.split(/[•·]/);
  if (parts.length > 1) return parts.slice(1).join("·").trim() || selection;
  return selection;
}

function Icon({ kind }: { kind: MarketMeta["icon"] }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none" as const };
  if (kind === "clock") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8v4.2l2.6 1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "shield") {
    return (
      <svg {...common} aria-hidden>
        <path
          d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "split") {
    return (
      <svg {...common} aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "goals") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "btts") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="9" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="15" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="1.7" />
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

function groupRows(group: BetMarketGroup) {
  // Keep top outcomes; OU markets can be long — show top lines by probability.
  const limit = group.number === 5 || group.number === 12 ? 6 : 5;
  return [...group.options].sort((a, b) => b.probability - a.probability).slice(0, limit);
}

export function MemberMatchMarkets({
  groups,
}: {
  groups: BetMarketGroup[];
}) {
  const { t, locale } = useLanguage();
  const available = useMemo(() => {
    const open = groups.filter((group) => group.available && group.options.length > 0);
    const preferred = PREFERRED_NUMBERS.map((n) => open.find((g) => g.number === n)).filter(
      Boolean,
    ) as BetMarketGroup[];
    const rest = open.filter((g) => !PREFERRED_NUMBERS.includes(g.number));
    return [...preferred, ...rest];
  }, [groups]);

  const [active, setActive] = useState<string>("all");

  const tabs = useMemo(
    () =>
      available
        .filter((group) => PREFERRED_NUMBERS.includes(group.number) || available.length <= 8)
        .slice(0, 8)
        .map((group) => {
          const meta = metaFor(group.title);
          return { id: String(group.number), label: meta.short, title: group.title };
        }),
    [available],
  );

  const visible = useMemo(() => {
    if (active === "all") {
      return available.filter((g) => PREFERRED_NUMBERS.includes(g.number)).slice(0, 6);
    }
    return available.filter((group) => String(group.number) === active);
  }, [available, active]);

  if (!available.length) return null;

  return (
    <section className={styles.wrap} aria-label={t("Match prediction markets")}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t("Match prediction markets")}</h2>
        <p className={styles.lead}>
          {t("Model probability (%) and fair odds for this match.")}
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t("Market filters")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id || (active === "all" && false)}
            data-active={active === tab.id ? "true" : active === "all" ? "soft" : undefined}
            title={tab.title}
            onClick={() => setActive((prev) => (prev === tab.id ? "all" : tab.id))}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.groups}>
        {visible.map((group) => {
          const meta = metaFor(group.title);
          const blurb = locale === "en" ? meta.blurbEn : meta.blurbTr;
          const rows = groupRows(group);
          return (
            <article className={styles.group} key={group.number}>
              <div className={styles.side}>
                <span className={styles.groupIcon}>
                  <Icon kind={meta.icon} />
                </span>
                <div>
                  <h3>{meta.short}</h3>
                  <p>{blurb}</p>
                </div>
              </div>

              <div className={styles.table}>
                <div className={styles.cols} aria-hidden>
                  <span>{t("Market code")}</span>
                  <span>{t("Selection")}</span>
                  <span className={styles.colBar} />
                  <span>{t("Model probability")}</span>
                  <span>{t("Odds")}</span>
                </div>
                <ul className={styles.rows}>
                  {rows.map((option) => {
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
                        <span className={styles.bar} aria-hidden>
                          <i style={{ width: `${Math.max(4, pct)}%` }} />
                        </span>
                        <b className={styles.pct}>%{pct.toFixed(0)}</b>
                        <span className={styles.odds}>{option.fairOdds.toFixed(2)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
