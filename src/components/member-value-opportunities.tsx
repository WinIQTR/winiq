"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";

import styles from "./member-value-opportunities.module.css";

export type MemberValueOpportunity = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueName: string;
  kickoffIso: string;
  kickoffLabel: string;
  market: string;
  selection: string;
  marketLabel: string;
  modelOdds: number | null;
  confidenceScore: number;
  href: string;
};

type SortKey = "confidence" | "odds" | "kickoff";
type ConfidenceFloor = "all" | "75" | "85" | "95";

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <Image className={styles.logo} src={src} alt="" width={36} height={36} />;
  }
  return <span className={styles.logoFall}>{name.slice(0, 2).toUpperCase()}</span>;
}

function toneFor(score: number): "high" | "mid" | "low" {
  if (score >= 85) return "high";
  if (score >= 75) return "mid";
  return "low";
}

export function MemberValueOpportunities({
  opportunities,
}: {
  opportunities: MemberValueOpportunity[];
}) {
  const { t } = useLanguage();
  const [sort, setSort] = useState<SortKey>("confidence");
  const [league, setLeague] = useState("ALL");
  const [market, setMarket] = useState("ALL");
  const [confidenceFloor, setConfidenceFloor] = useState<ConfidenceFloor>("all");

  const leagues = useMemo(() => {
    const names = [...new Set(opportunities.map((item) => item.leagueName))];
    return names.sort((a, b) => a.localeCompare(b, "tr"));
  }, [opportunities]);

  const markets = useMemo(() => {
    const names = [...new Set(opportunities.map((item) => item.market).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, "en"));
  }, [opportunities]);

  const filtered = useMemo(() => {
    const floor =
      confidenceFloor === "all" ? 0 : Number(confidenceFloor);
    const rows = opportunities.filter((item) => {
      if (league !== "ALL" && item.leagueName !== league) return false;
      if (market !== "ALL" && item.market !== market) return false;
      if (item.confidenceScore < floor) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sort === "odds") {
        return (a.modelOdds ?? 99) - (b.modelOdds ?? 99);
      }
      if (sort === "kickoff") {
        return new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime();
      }
      return b.confidenceScore - a.confidenceScore;
    });

    return rows;
  }, [opportunities, sort, league, market, confidenceFloor]);

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="value-opportunities-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow} data-no-translate>
            WINIQ · {t("VALUE PICKS")}
          </p>
          <h1 id="value-opportunities-title">{t("High-confidence opportunities")}</h1>
          <p>
            {t(
              "A simple list ordered by model odds and confidence score. No market jargon — just clear picks.",
            )}
          </p>
        </div>
        <div className={styles.heroMetrics} aria-hidden>
          <div className={styles.metric}>
            <span>{t("BETTER DATA")}</span>
            <i style={{ width: "92%" }} />
          </div>
          <div className={styles.metric}>
            <span>{t("CLEARER ANALYSIS")}</span>
            <i style={{ width: "78%" }} />
          </div>
          <div className={styles.metric}>
            <span>{t("MORE OPPORTUNITIES")}</span>
            <i style={{ width: "86%" }} />
          </div>
        </div>
      </section>

      <section className={styles.controls} aria-label={t("Opportunity filters")}>
        <div className={styles.countBlock}>
          <span className={styles.countIcon} aria-hidden>
            ⌖
          </span>
          <div>
            <div>
              <strong>{filtered.length}</strong>
            </div>
            <span>
              {t("Today's recommended matches")} · {filtered.length} {t("opportunities")}
            </span>
          </div>
        </div>

        <div className={styles.filters}>
          <label className={styles.field}>
            <span>{t("Sort")}</span>
            <select
              value={sort}
              aria-label={t("Sort")}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="confidence">{t("Confidence score")}</option>
              <option value="odds">{t("Model odds")}</option>
              <option value="kickoff">{t("Kickoff")}</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>{t("Confidence score")}</span>
            <select
              value={confidenceFloor}
              aria-label={t("Confidence filter")}
              onChange={(event) => setConfidenceFloor(event.target.value as ConfidenceFloor)}
            >
              <option value="all">{t("All")}</option>
              <option value="75">75%+</option>
              <option value="85">85%+</option>
              <option value="95">95%+</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>{t("League")}</span>
            <select
              value={league}
              aria-label={t("League")}
              onChange={(event) => setLeague(event.target.value)}
            >
              <option value="ALL">{t("All Leagues")}</option>
              {leagues.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{t("Market")}</span>
            <select
              value={market}
              aria-label={t("Market")}
              onChange={(event) => setMarket(event.target.value)}
            >
              <option value="ALL">{t("All markets")}</option>
              {markets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.chipRow} role="toolbar" aria-label={t("Opportunity filters")}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={sort === "confidence"}
            onClick={() => setSort("confidence")}
          >
            {t("Confidence score")}
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={sort === "odds"}
            onClick={() => setSort("odds")}
          >
            {t("Model odds")}
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={confidenceFloor === "85"}
            onClick={() => setConfidenceFloor(confidenceFloor === "85" ? "all" : "85")}
          >
            85%+
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={league !== "ALL"}
            onClick={() => setLeague("ALL")}
          >
            {league === "ALL" ? t("League") : league}
          </button>
          <button
            type="button"
            className={styles.chip}
            aria-pressed={market !== "ALL"}
            onClick={() => setMarket("ALL")}
          >
            {market === "ALL" ? t("Market") : market}
          </button>
        </div>
      </section>

      <div className={styles.grid}>
        {filtered.length ? (
          filtered.map((item, index) => {
            const tone = toneFor(item.confidenceScore);
            return (
              <article className={styles.card} key={item.matchId}>
                <div className={styles.cardTop}>
                  <span className={styles.rank}>#{index + 1}</span>
                  <span className={styles.badge} data-tone={tone}>
                    %{item.confidenceScore.toFixed(0)} {t("confidence")} · {t("model odds")}{" "}
                    {item.modelOdds != null ? item.modelOdds.toFixed(2) : "—"}
                  </span>
                </div>

                <div className={styles.matchup}>
                  <div className={styles.team}>
                    <TeamLogo src={item.homeTeamLogo} name={item.homeTeam} />
                    <strong>{item.homeTeam}</strong>
                  </div>
                  <span className={styles.versus}>VS</span>
                  <div className={styles.team}>
                    <TeamLogo src={item.awayTeamLogo} name={item.awayTeam} />
                    <strong>{item.awayTeam}</strong>
                  </div>
                </div>

                <div className={styles.meta}>
                  <strong>{item.leagueName}</strong>
                  <span>{item.kickoffLabel}</span>
                </div>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span>{t("Market / Selection")}</span>
                    <strong title={item.marketLabel}>{item.marketLabel}</strong>
                  </div>
                  <div className={styles.stat}>
                    <span>{t("Model odds")}</span>
                    <em>{item.modelOdds != null ? item.modelOdds.toFixed(2) : "—"}</em>
                  </div>
                  <div className={styles.stat}>
                    <span>{t("Confidence score")}</span>
                    <div className={styles.barWrap}>
                      <div className={styles.barTrack} aria-hidden>
                        <i
                          className={styles.barFill}
                          style={{ width: `${Math.max(4, Math.min(100, item.confidenceScore))}%` }}
                        />
                      </div>
                      <div className={styles.barLabel}>%{item.confidenceScore.toFixed(0)}</div>
                    </div>
                  </div>
                </div>

                <Link className={styles.cta} href={item.href}>
                  {t("View match analysis")} →
                </Link>
              </article>
            );
          })
        ) : (
          <div className={styles.empty}>
            {t("No high-confidence opportunities are available right now.")}
          </div>
        )}
      </div>
    </div>
  );
}
