"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";

import styles from "./member-results.module.css";

export type MemberResultsBand = {
  rate: number | null;
  wins: number;
  losses: number;
  samples: number;
};

export type MemberResultsMatch = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueName: string;
  dateLabel: string;
  dateKey: string;
  status: "WON" | "LOST" | "VOID" | "PENDING" | "OTHER";
  statusLabel: string;
  href: string;
};

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <Image className={styles.logo} src={src} alt="" width={28} height={28} />;
  }
  return <span className={styles.logoFall}>{name.slice(0, 2).toUpperCase()}</span>;
}

function pillClass(status: MemberResultsMatch["status"]) {
  if (status === "WON") return styles.pillWon;
  if (status === "LOST") return styles.pillLost;
  if (status === "VOID") return styles.pillVoid;
  return styles.pillPending;
}

export function MemberResultsBoard({
  strong,
  medium,
  weak,
  matches,
  todayHref = "/member",
}: {
  strong: MemberResultsBand;
  medium: MemberResultsBand;
  weak: MemberResultsBand;
  matches: MemberResultsMatch[];
  todayHref?: string;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState("ALL");
  const [date, setDate] = useState("ALL");
  const [result, setResult] = useState("ALL");

  const leagues = useMemo(() => {
    return [...new Set(matches.map((item) => item.leagueName))].sort((a, b) =>
      a.localeCompare(b, "tr"),
    );
  }, [matches]);

  const dates = useMemo(() => {
    return [...new Set(matches.map((item) => item.dateKey))].sort().reverse();
  }, [matches]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return matches.filter((item) => {
      if (league !== "ALL" && item.leagueName !== league) return false;
      if (date !== "ALL" && item.dateKey !== date) return false;
      if (result !== "ALL" && item.status !== result) return false;
      if (!q) return true;
      return (
        item.homeTeam.toLowerCase().includes(q) ||
        item.awayTeam.toLowerCase().includes(q) ||
        item.leagueName.toLowerCase().includes(q)
      );
    });
  }, [matches, search, league, date, result]);

  const bands = [
    { key: "strong", label: t("Strong"), tone: "strong" as const, icon: "🛡", band: strong },
    { key: "medium", label: t("Medium"), tone: "medium" as const, icon: "▦", band: medium },
    { key: "weak", label: t("Weak"), tone: "weak" as const, icon: "⚡", band: weak },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.crumb} data-no-translate>
            WINIQ &gt; {t("MY RESULTS")}
          </p>
          <h1>{t("Past performance")}</h1>
          <p>{t("Summary of published picks. For information only.")}</p>
        </div>
        <Link className={styles.backLink} href={todayHref}>
          ← {t("Back to today's predictions")}
        </Link>
      </section>

      <section aria-labelledby="results-summary-title">
        <div className={styles.sectionHead}>
          <small>{t("SUMMARY")}</small>
          <h2 id="results-summary-title">{t("Strong / medium / weak")}</h2>
        </div>
        <div className={styles.summaryGrid}>
          {bands.map((item) => {
            const rate = item.band.rate;
            return (
              <article className={styles.summaryCard} data-tone={item.tone} key={item.key}>
                <div className={styles.summaryTop}>
                  <span className={styles.summaryIcon} aria-hidden>
                    {item.icon}
                  </span>
                  <strong>{item.label}</strong>
                </div>
                <div className={styles.rateRow}>
                  <div className={styles.barTrack} aria-hidden>
                    <i className={styles.barFill} style={{ width: `${Math.max(0, Math.min(100, rate ?? 0))}%` }} />
                  </div>
                  <em>{rate === null ? "—" : `%${rate.toFixed(0)}`}</em>
                </div>
                <div className={styles.statRow}>
                  <span>
                    <b>{item.band.wins}</b>
                    {t("Won")}
                  </span>
                  <span>
                    <b>{item.band.losses}</b>
                    {t("Lost")}
                  </span>
                  <span>
                    <b>{item.band.samples}</b>
                    {t("Evaluated")}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="results-list-title">
        <div className={styles.sectionHead}>
          <small>{t("RECENT MATCHES")}</small>
          <h2 id="results-list-title">{t("Recent results")}</h2>
          <p>
            {matches.length
              ? `${matches.length} ${t("published records listed.")}`
              : t("No settled predictions yet.")}
          </p>
        </div>

        <div className={styles.filters} aria-label={t("Result filters")}>
          <label className={styles.field}>
            <span>{t("Search")}</span>
            <input
              type="search"
              value={search}
              placeholder={t("Search match, team or league...")}
              aria-label={t("Search match, team or league...")}
              onChange={(event) => setSearch(event.target.value)}
            />
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
            <span>{t("Date")}</span>
            <select value={date} aria-label={t("Date")} onChange={(event) => setDate(event.target.value)}>
              <option value="ALL">{t("All dates")}</option>
              {dates.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{t("Result")}</span>
            <select
              value={result}
              aria-label={t("Result")}
              onChange={(event) => setResult(event.target.value)}
            >
              <option value="ALL">{t("All results")}</option>
              <option value="WON">{t("Won")}</option>
              <option value="LOST">{t("Lost")}</option>
              <option value="VOID">{t("Void")}</option>
              <option value="PENDING">{t("Not settled yet")}</option>
            </select>
          </label>
          <div className={styles.resultCount}>
            {filtered.length} {t("results found")}
          </div>
        </div>

        <div className={styles.list}>
          {filtered.length ? (
            filtered.map((item) => (
              <article className={styles.row} key={item.matchId}>
                <div className={styles.teams}>
                  <div className={styles.teamLine}>
                    <TeamLogo src={item.homeTeamLogo} name={item.homeTeam} />
                    <strong>{item.homeTeam}</strong>
                  </div>
                  <div className={styles.teamLine}>
                    <TeamLogo src={item.awayTeamLogo} name={item.awayTeam} />
                    <strong>{item.awayTeam}</strong>
                  </div>
                </div>
                <div className={styles.meta}>
                  <strong>{item.leagueName}</strong>
                  <span>{item.dateLabel}</span>
                </div>
                <span className={`${styles.pill} ${pillClass(item.status)}`}>{t(item.statusLabel)}</span>
                <Link className={styles.detail} href={item.href}>
                  {t("Details")} ›
                </Link>
              </article>
            ))
          ) : (
            <div className={styles.empty}>{t("No matches match these filters.")}</div>
          )}
        </div>
      </section>
    </div>
  );
}
