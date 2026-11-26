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

export type MemberResultsOddsBand = MemberResultsBand & {
  key: string;
  label: string;
  tone: "band1" | "band2" | "band3" | "band4" | "band5";
};

export type MemberResultsMatch = {
  matchId: number;
  rowKey?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  leagueName: string;
  dateLabel: string;
  dateKey: string;
  /** Combined fallback · prefer marketLabel + selectionLabel for row UI. */
  pickLabel?: string;
  marketLabel?: string;
  selectionLabel?: string;
  tierLabel?: "strong" | "medium" | "weak";
  oddsBandKey?: string | null;
  status: "WON" | "LOST" | "VOID" | "PENDING" | "OTHER";
  statusLabel: string;
  href: string;
};

export type MemberResultsV2Panel = {
  equitySparkline: string | null;
  clvPct: number | null;
  loggedBeforeKickoffPct: number | null;
  streakLabel: string;
  leagueChips: Array<{ label: string; rate: number; samples: number }>;
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
  oddsBands = [],
  strengthEvaluated = 0,
  oddsBandEvaluated = 0,
  oddsMissing = 0,
  matches,
  v2 = null,
  todayHref = "/member",
}: {
  strong: MemberResultsBand;
  medium: MemberResultsBand;
  weak: MemberResultsBand;
  oddsBands?: MemberResultsOddsBand[];
  strengthEvaluated?: number;
  oddsBandEvaluated?: number;
  oddsMissing?: number;
  matches: MemberResultsMatch[];
  v2?: MemberResultsV2Panel | null;
  todayHref?: string;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState("ALL");
  const [date, setDate] = useState("ALL");
  const [result, setResult] = useState("ALL");
  const [oddsBand, setOddsBand] = useState("ALL");

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
      if (oddsBand !== "ALL" && item.oddsBandKey !== oddsBand) return false;
      if (!q) return true;
      return (
        item.homeTeam.toLowerCase().includes(q) ||
        item.awayTeam.toLowerCase().includes(q) ||
        item.leagueName.toLowerCase().includes(q) ||
        (item.pickLabel ?? "").toLowerCase().includes(q) ||
        (item.marketLabel ?? "").toLowerCase().includes(q) ||
        (item.selectionLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [matches, search, league, date, result, oddsBand]);

  /** One accordion card per match — picks nest underneath (screenshot layout). */
  const matchGroups = useMemo(() => {
    const map = new Map<
      number,
      {
        matchId: number;
        homeTeam: string;
        awayTeam: string;
        homeTeamLogo: string | null;
        awayTeamLogo: string | null;
        leagueName: string;
        dateLabel: string;
        dateKey: string;
        href: string;
        picks: MemberResultsMatch[];
      }
    >();

    for (const item of filtered) {
      const existing = map.get(item.matchId);
      if (existing) {
        existing.picks.push(item);
        continue;
      }
      map.set(item.matchId, {
        matchId: item.matchId,
        homeTeam: item.homeTeam,
        awayTeam: item.awayTeam,
        homeTeamLogo: item.homeTeamLogo,
        awayTeamLogo: item.awayTeamLogo,
        leagueName: item.leagueName,
        dateLabel: item.dateLabel,
        dateKey: item.dateKey,
        href: item.href,
        picks: [item],
      });
    }

    return [...map.values()];
  }, [filtered]);

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

      {v2 ? (
        <section className={styles.v2Panel} aria-label={t("Trust and bankroll")}>
          <article>
            <span>{t("1u equity")}</span>
            {v2.equitySparkline ? (
              <svg viewBox="0 0 100 28" width="140" height="36" aria-hidden>
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  points={v2.equitySparkline}
                />
              </svg>
            ) : (
              <strong>—</strong>
            )}
          </article>
          <article>
            <span>{t("CLV vs fair")}</span>
            <strong>
              {v2.clvPct == null
                ? "—"
                : `${v2.clvPct >= 0 ? "+" : ""}${v2.clvPct.toFixed(1)}%`}
            </strong>
          </article>
          <article>
            <span>{t("Pre-kickoff log")}</span>
            <strong>
              {v2.loggedBeforeKickoffPct == null
                ? "—"
                : `%${v2.loggedBeforeKickoffPct.toFixed(0)}`}
            </strong>
          </article>
          <article>
            <span>{t("Recent form")}</span>
            <strong>{t(v2.streakLabel)}</strong>
          </article>
          <p className={styles.voidNote}>
            {t("Voids are counted separately — not as losses.")}
          </p>
          {v2.leagueChips.length > 0 ? (
            <div className={styles.chipRow}>
              {v2.leagueChips.map((chip) => (
                <button
                  type="button"
                  key={chip.label}
                  className={styles.chip}
                  data-active={league === chip.label}
                  onClick={() =>
                    setLeague((current) =>
                      current === chip.label ? "ALL" : chip.label,
                    )
                  }
                >
                  {chip.label} · %{chip.rate.toFixed(0)} ({chip.samples})
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {oddsBands.length > 0 ? (
        <section aria-labelledby="results-odds-summary-title">
          <div className={styles.sectionHead}>
            <small>{t("SUMMARY")}</small>
            <h2 id="results-odds-summary-title">{t("Odds bands")}</h2>
            <p data-no-translate={false}>
              <strong data-no-translate>
                {oddsBandEvaluated.toLocaleString("tr-TR")}
              </strong>
              {" / "}
              <strong data-no-translate>
                {strengthEvaluated.toLocaleString("tr-TR")}
              </strong>{" "}
              {t("evaluated in odds bands")}
              {oddsMissing > 0 ? (
                <>
                  {" · "}
                  <strong data-no-translate>
                    {oddsMissing.toLocaleString("tr-TR")}
                  </strong>{" "}
                  {t("No odds")}
                </>
              ) : null}
              {oddsBand !== "ALL" ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className={styles.clearBand}
                    onClick={() => setOddsBand("ALL")}
                  >
                    {t("Clear band filter")}
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <div className={styles.oddsSummaryGrid}>
            {oddsBands.map((item) => {
              const rate = item.rate;
              return (
                <article
                  className={styles.summaryCard}
                  data-tone={item.tone}
                  data-active={oddsBand === item.key}
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setOddsBand((current) =>
                      current === item.key ? "ALL" : item.key,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOddsBand((current) =>
                        current === item.key ? "ALL" : item.key,
                      );
                    }
                  }}
                >
                  <div className={styles.summaryTop}>
                    <span className={styles.summaryIcon} aria-hidden>
                      #
                    </span>
                    <strong data-no-translate>{item.label}</strong>
                  </div>
                  <div className={styles.rateRow}>
                    <div className={styles.barTrack} aria-hidden>
                      <i
                        className={styles.barFill}
                        style={{
                          width: `${Math.max(0, Math.min(100, rate ?? 0))}%`,
                        }}
                      />
                    </div>
                    <em>{rate === null ? "—" : `%${rate.toFixed(0)}`}</em>
                  </div>
                  <div className={styles.statRow}>
                    <span>
                      <b>{item.wins}</b>
                      {t("Won")}
                    </span>
                    <span>
                      <b>{item.losses}</b>
                      {t("Lost")}
                    </span>
                    <span>
                      <b>{item.samples}</b>
                      {t("Evaluated")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="results-list-title">
        <div className={styles.sectionHead}>
          <small>{t("Published picks")}</small>
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
            {matchGroups.length} {t("results found")}
          </div>
        </div>

        <div className={styles.list}>
          {matchGroups.length ? (
            matchGroups.map((group) => {
              const multi = group.picks.length > 1;
              const primary = group.picks[0]!;

              const pickCells = (item: MemberResultsMatch) => (
                <div className={styles.pickFields}>
                  <div className={styles.pickField}>
                    <span className={styles.fieldLabel}>{t("Market field")}</span>
                    <strong>{item.marketLabel ?? item.pickLabel ?? "—"}</strong>
                  </div>
                  <div className={styles.pickDivider} aria-hidden />
                  <div className={styles.pickField}>
                    <span className={styles.fieldLabel}>{t("Selection")}</span>
                    <strong>{item.selectionLabel ?? "—"}</strong>
                  </div>
                </div>
              );

              const head = (
                <>
                  <div className={styles.teams}>
                    <div className={styles.teamLine}>
                      <TeamLogo src={group.homeTeamLogo} name={group.homeTeam} />
                      <strong>{group.homeTeam}</strong>
                    </div>
                    <div className={styles.teamLine}>
                      <TeamLogo src={group.awayTeamLogo} name={group.awayTeam} />
                      <strong>{group.awayTeam}</strong>
                    </div>
                  </div>

                  <div className={styles.matchMeta}>
                    <span className={styles.leagueBadge}>{group.leagueName}</span>
                    <span className={styles.dateBadge}>{group.dateLabel}</span>
                  </div>
                </>
              );

              if (!multi) {
                return (
                  <article
                    className={`${styles.matchCard} ${styles.matchCardFlat}`}
                    key={`${group.matchId}-${group.dateKey}`}
                  >
                    <div className={styles.matchSummary}>
                      {head}
                    </div>
                    <div className={styles.pickList}>
                      <div className={styles.pickRow}>
                        {pickCells(primary)}
                        <span className={`${styles.pill} ${pillClass(primary.status)}`}>
                          {t(primary.statusLabel)}
                        </span>
                        <Link className={styles.detail} href={primary.href}>
                          {t("Details")} ›
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              }

              return (
                <details
                  className={styles.matchCard}
                  key={`${group.matchId}-${group.dateKey}`}
                  open
                >
                  <summary className={styles.matchSummary}>
                    {head}
                    <div className={styles.pickCount}>
                      <strong>
                        {group.picks.length} {t("predictions")}
                      </strong>
                    </div>
                  </summary>
                  <div className={styles.pickList}>
                    {group.picks.map((item) => (
                      <div
                        className={styles.pickRow}
                        key={item.rowKey ?? `${item.matchId}-${item.pickLabel}`}
                      >
                        {pickCells(item)}
                        <span className={`${styles.pill} ${pillClass(item.status)}`}>
                          {t(item.statusLabel)}
                        </span>
                        <Link className={styles.detail} href={item.href}>
                          {t("Details")} ›
                        </Link>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })
          ) : (
            <div className={styles.empty}>{t("No matches match these filters.")}</div>
          )}
        </div>
      </section>
    </div>
  );
}
