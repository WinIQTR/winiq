"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import type { BetMarketGroup } from "@/lib/bet-market-catalog";
import { settleBetMarketOption } from "@/lib/bet-market-catalog";
import { probabilityTone } from "@/lib/probability-tone";

import styles from "./member-match-markets.module.css";

/** Preferred market order matching the mockup chips. */
const PREFERRED_NUMBERS = [1, 2, 3, 4, 5, 8];

type MarketMeta = {
  short: string;
  blurbTr: string;
  blurbEn: string;
};

const MARKET_META: Record<string, MarketMeta> = {
  "Maç Sonucu": {
    short: "1X2",
    blurbTr: "Maç sonucu (90 dakika).",
    blurbEn: "Full-time result (90 minutes).",
  },
  "Match Result": {
    short: "1X2",
    blurbTr: "Maç sonucu (90 dakika).",
    blurbEn: "Full-time result (90 minutes).",
  },
  "Çifte Şans": {
    short: "Çifte Şans",
    blurbTr: "İki sonuçtan biri.",
    blurbEn: "Two outcomes covered.",
  },
  "Double Chance": {
    short: "Double Chance",
    blurbTr: "İki sonuçtan biri.",
    blurbEn: "Two outcomes covered.",
  },
  "İlk Yarı Sonucu": {
    short: "İlk Yarı",
    blurbTr: "İlk 45 dakika sonucu.",
    blurbEn: "First-half result.",
  },
  "Half-Time Result": {
    short: "1st Half",
    blurbTr: "İlk 45 dakika sonucu.",
    blurbEn: "First-half result.",
  },
  "İlk Yarı / Maç Sonucu": {
    short: "İlk Yarı/Maç Sonucu",
    blurbTr: "Devre ve maç sonucu.",
    blurbEn: "Half-time / full-time.",
  },
  "Half-Time / Full-Time": {
    short: "HT/FT",
    blurbTr: "Devre ve maç sonucu.",
    blurbEn: "Half-time / full-time.",
  },
  "Toplam Gol Alt / Üst": {
    short: "Toplam Gol Alt/Üst",
    blurbTr: "Toplam gol çizgileri.",
    blurbEn: "Total goals lines.",
  },
  "Total Goals Over / Under": {
    short: "Over/Under",
    blurbTr: "Toplam gol çizgileri.",
    blurbEn: "Total goals lines.",
  },
  "Karşılıklı Gol": {
    short: "BTTS",
    blurbTr: "Karşılıklı gol var / yok.",
    blurbEn: "Both teams to score.",
  },
  "Both Teams to Score": {
    short: "BTTS",
    blurbTr: "Karşılıklı gol var / yok.",
    blurbEn: "Both teams to score.",
  },
};

function metaFor(title: string): MarketMeta {
  return (
    MARKET_META[title] ?? {
      short: title,
      blurbTr: "Model seçimleri.",
      blurbEn: "Model selections.",
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

function groupRows(group: BetMarketGroup) {
  const limit = group.number === 5 || group.number === 12 ? 6 : 5;
  return [...group.options].sort((a, b) => b.probability - a.probability).slice(0, limit);
}

function settlementLabel(
  value: ReturnType<typeof settleBetMarketOption>,
  t: (key: string) => string,
): string {
  if (value === "WON") return t("Won");
  if (value === "LOST") return t("Lost");
  if (value === "VOID") return t("Void");
  return t("No result data");
}

export function MemberMatchMarkets({
  groups,
  finalHomeScore = null,
  finalAwayScore = null,
}: {
  groups: BetMarketGroup[];
  finalHomeScore?: number | null;
  finalAwayScore?: number | null;
}) {
  const { t, locale } = useLanguage();
  const settled = finalHomeScore != null && finalAwayScore != null;
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
        <div className={styles.headCopy}>
          <h2 className={styles.title}>{t("Match prediction markets")}</h2>
          <p className={styles.lead}>
            {t("Model probability (%) and fair odds for this match.")}
          </p>
        </div>
        {settled ? (
          <div className={styles.legend} aria-label={t("Result legend")}>
            <span className={styles.legendWon}>{t("Won")}</span>
            <span className={styles.legendLost}>{t("Lost")}</span>
            <span className={styles.legendMissing}>{t("No result data")}</span>
          </div>
        ) : null}
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
            <article className={styles.group} key={group.number} data-settled={settled ? "true" : "false"}>
              <div className={styles.side}>
                <h3>{meta.short}</h3>
                <p>{blurb}</p>
              </div>

              <div className={styles.table}>
                <div className={styles.cols} aria-hidden>
                  <span>{t("Market code")}</span>
                  <span>{t("Selection")}</span>
                  <span className={styles.colBar} />
                  <span>{t("Pre-match probability")}</span>
                  <span>{t("Odds")}</span>
                  {settled ? <span>{t("Realized prediction")}</span> : null}
                </div>
                <ul className={styles.rows}>
                  {rows.map((option) => {
                    const pct = Math.max(0, Math.min(100, option.probability));
                    const tone = probabilityTone(pct);
                    const outcome = settled
                      ? settleBetMarketOption(option.key, finalHomeScore, finalAwayScore)
                      : null;
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
                        {outcome ? (
                          <span
                            className={styles.outcome}
                            data-outcome={outcome}
                          >
                            {settlementLabel(outcome, t)}
                          </span>
                        ) : null}
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
