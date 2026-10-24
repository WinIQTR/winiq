"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import {
  getPredictionLabel,
  getUiConfidence,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";
import { type MembershipPlanName } from "@/lib/membership-access";
import { LOCK_HINT } from "@/lib/membership-lock-copy";

import styles from "./member-predictions-board.module.css";

const TZ = "Europe/Istanbul";
const PAGE_SIZE = 6;

type ConfidenceFilter = "ALL" | "HIGH" | "MED" | "LOW";

type DraftFilters = {
  date: string;
  league: string;
  market: string;
  confidence: ConfidenceFilter;
};

type PerformanceBand = {
  rate: number | null;
  samples: number;
  wins: number;
  losses: number;
};

export type MemberHomePerformance = {
  strong: PerformanceBand;
  medium: PerformanceBand;
  weak: PerformanceBand;
};

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value));
}

function todayKey(now = new Date()) {
  return dateKey(now);
}

function fairOdds(prediction: DashboardPrediction) {
  const fromPick = prediction.topPicks[0]?.fairOdds;
  if (fromPick && fromPick > 0) return fromPick;
  return prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
}

function pickProbability(prediction: DashboardPrediction) {
  return prediction.topPicks[0]?.probability ?? prediction.predictedProbability;
}

function translatePick(value: string) {
  return value
    .replace(/Home Team Goals/gi, "Ev sahibi takım golü")
    .replace(/Away Team Goals/gi, "Deplasman takım golü")
    .replace(/Total Goals/gi, "Toplam gol")
    .replace(/Both Teams To Score/gi, "Karşılıklı gol")
    .replace(/Under/gi, "Alt")
    .replace(/Over/gi, "Üst")
    .replace(/Home/gi, "Ev sahibi")
    .replace(/Away/gi, "Deplasman")
    .replace(/Draw/gi, "Beraberlik");
}

function confidenceMeta(score: number) {
  const filled = Math.min(5, Math.max(1, Math.round(score / 20)));
  const level = getUiConfidence(score);
  if (level === "Very High" || level === "High") {
    return { label: "High", kind: "high" as const, filled: Math.max(filled, 4) };
  }
  if (level === "Medium") {
    return {
      label: score >= 55 ? "Medium-High" : "Medium",
      kind: "med" as const,
      filled: Math.max(filled, 3),
    };
  }
  return { label: "Low", kind: "low" as const, filled };
}

function pickChip(prediction: DashboardPrediction) {
  const top = prediction.topPicks[0];
  if (top) {
    const marketRaw = top.market || "Match result";
    const market = /total\s*goals/i.test(marketRaw)
      ? "Total Goals"
      : /match\s*result|1x2|full\s*time/i.test(marketRaw)
        ? "Match result"
        : translatePick(marketRaw);
    return { market, tip: translatePick(top.selection || getPredictionLabel(prediction)) };
  }
  if (prediction.predictedOutcome === "HOME") {
    return { market: "Match result", tip: `1 (${prediction.homeTeam})` };
  }
  if (prediction.predictedOutcome === "AWAY") {
    return { market: "Match result", tip: `2 (${prediction.awayTeam})` };
  }
  return { market: "Match result", tip: "X" };
}

function leagueFlagCode(leagueName: string) {
  const name = leagueName.toLowerCase();
  if (name.includes("premier") || name.includes("england") || name.includes("efl")) return "EN";
  if (name.includes("bundesliga") || name.includes("germany")) return "DE";
  if (name.includes("serie a") || name.includes("italy")) return "IT";
  if (name.includes("laliga") || name.includes("la liga") || name.includes("spain")) return "ES";
  if (name.includes("ligue") || name.includes("france")) return "FR";
  if (name.includes("süper") || name.includes("super lig") || name.includes("turkey")) return "TR";
  if (name.includes("eredivisie") || name.includes("netherlands")) return "NL";
  if (name.includes("champions") || name.includes("europa") || name.includes("uefa")) return "EU";
  return leagueName.slice(0, 2).toUpperCase();
}

function isFinished(prediction: DashboardPrediction) {
  return (
    prediction.settlementStatus === "WON" ||
    prediction.settlementStatus === "LOST" ||
    prediction.settlementStatus === "VOID" ||
    (prediction.finalHomeScore != null && prediction.finalAwayScore != null)
  );
}

function isUpcoming(prediction: DashboardPrediction, now: Date) {
  return asDate(prediction.kickoffAt).getTime() >= now.getTime() && !isFinished(prediction);
}

function shortAnalysis(prediction: DashboardPrediction) {
  const reason = prediction.topPicks[0]?.reasons?.[0];
  if (reason) return reason;
  const label = translatePick(getPredictionLabel(prediction));
  const probability = pickProbability(prediction);
  return `${prediction.homeTeam} – ${prediction.awayTeam}: ${label}. Model probability ${probability.toFixed(0)}%.`;
}

function TeamLogo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <Image
        className={styles.logo}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className={styles.logoFall} style={{ width: size, height: size, flexBasis: size }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function IconCal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.5V17M12 7.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 3.5V8h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconClock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V9M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconFilter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 6H4.5A2.5 2.5 0 0 0 7 10.5M17 6h2.5A2.5 2.5 0 0 1 17 10.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function MemberPredictionsBoard({
  predictions,
  plan,
  matchPathPrefix = "/member/matches",
  matchQuery = "",
  plansHref = "/member/plans",
  couponsHref = "/member/coupons",
  selectedDate,
  updatedAtIso,
  performance,
}: {
  predictions: DashboardPrediction[];
  plan: MembershipPlanName;
  matchPathPrefix?: string;
  matchQuery?: string;
  plansHref?: string;
  couponsHref?: string;
  selectedDate?: string;
  updatedAtIso?: string;
  performance?: MemberHomePerformance;
}) {
  const { t, locale } = useLanguage();
  const matchHref = (matchId: number) => `${matchPathPrefix}/${matchId}${matchQuery}`;
  const now = useMemo(() => new Date(), []);
  const showOdds = plan !== "BASIC";
  const today = todayKey(now);
  const lang = locale === "tr" ? "tr-TR" : "en-GB";

  const initialDate = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : today;
  const emptyDraft: DraftFilters = {
    date: initialDate,
    league: "ALL",
    market: "ALL",
    confidence: "ALL",
  };

  const [draft, setDraft] = useState<DraftFilters>(emptyDraft);
  const [applied, setApplied] = useState<DraftFilters>(emptyDraft);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const formatLongDate = (key: string) =>
    new Intl.DateTimeFormat(lang, {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${key}T12:00:00`));

  const formatKickLabel = (value: Date | string) => {
    const d = asDate(value);
    const key = dateKey(d);
    const time = new Intl.DateTimeFormat(lang, {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    if (key === today) return `${t("Today")} ${time}`;
    const day = new Intl.DateTimeFormat(lang, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
    }).format(d);
    return `${day} ${time}`;
  };

  const formatUpdate = (iso?: string) => {
    const d = iso ? new Date(iso) : now;
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(lang, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const upcoming = useMemo(
    () =>
      predictions
        .filter((item) => isUpcoming(item, now))
        .sort((a, b) => asDate(a.kickoffAt).getTime() - asDate(b.kickoffAt).getTime()),
    [predictions, now],
  );

  const todayMatches = useMemo(
    () => upcoming.filter((item) => dateKey(item.kickoffAt) === today),
    [upcoming, today],
  );

  const publishedToday = useMemo(
    () => todayMatches.filter((item) => item.confidenceScore >= 50 || item.topPicks.length > 0),
    [todayMatches],
  );

  const leagues = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of upcoming) map.set(item.leagueApiId, item.leagueName);
    return [...map.entries()]
      .map(([apiId, name]) => ({ apiId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [upcoming]);

  const markets = useMemo(() => {
    const names = new Set<string>();
    for (const item of upcoming) {
      const market = item.topPicks[0]?.market;
      if (market) names.add(market);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "en"));
  }, [upcoming]);

  const dateOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const item of upcoming) keys.add(dateKey(item.kickoffAt));
    if (!keys.has(today)) keys.add(today);
    return [...keys].sort();
  }, [upcoming, today]);

  const filtered = useMemo(() => {
    return upcoming.filter((item) => {
      if (applied.date !== "ALL" && dateKey(item.kickoffAt) !== applied.date) return false;
      if (applied.league !== "ALL" && String(item.leagueApiId) !== applied.league) return false;
      if (applied.market !== "ALL" && (item.topPicks[0]?.market ?? "") !== applied.market) return false;
      if (applied.confidence === "HIGH" && item.confidenceScore < 60) return false;
      if (applied.confidence === "MED" && (item.confidenceScore < 40 || item.confidenceScore >= 60)) {
        return false;
      }
      if (applied.confidence === "LOW" && item.confidenceScore >= 40) return false;
      return true;
    });
  }, [upcoming, applied]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const strongest = useMemo(() => {
    const pool = (todayMatches.length ? todayMatches : upcoming).slice();
    pool.sort(
      (a, b) =>
        b.confidenceScore - a.confidenceScore ||
        asDate(a.kickoffAt).getTime() - asDate(b.kickoffAt).getTime(),
    );
    return pool[0] ?? null;
  }, [todayMatches, upcoming]);

  const couponLegs = useMemo(() => {
    const pool = (todayMatches.length ? todayMatches : upcoming)
      .filter((item) => item.confidenceScore >= 55)
      .sort((a, b) => b.confidenceScore - a.confidenceScore);
    const picked: DashboardPrediction[] = [];
    for (const item of pool) {
      if (picked.length >= 3) break;
      if (picked.some((row) => row.matchId === item.matchId)) continue;
      picked.push(item);
    }
    return picked;
  }, [todayMatches, upcoming]);

  const couponOdds = couponLegs.reduce((acc, item) => {
    const odds = fairOdds(item);
    return odds > 0 ? acc * odds : acc;
  }, 1);

  const hasDraftDiff =
    draft.date !== applied.date ||
    draft.league !== applied.league ||
    draft.market !== applied.market ||
    draft.confidence !== applied.confidence;

  const hasActiveFilters =
    applied.date !== today ||
    applied.league !== "ALL" ||
    applied.market !== "ALL" ||
    applied.confidence !== "ALL";

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const next = { date: today, league: "ALL", market: "ALL", confidence: "ALL" as const };
    setDraft(next);
    setApplied(next);
    setPage(1);
  };

  const evaluatedSamples =
    (performance?.strong.samples ?? 0) +
    (performance?.medium.samples ?? 0) +
    (performance?.weak.samples ?? 0);
  const evaluatedWins =
    (performance?.strong.wins ?? 0) + (performance?.medium.wins ?? 0) + (performance?.weak.wins ?? 0);
  const hitRate = evaluatedSamples ? (evaluatedWins / evaluatedSamples) * 100 : null;
  const avgOdds =
    filtered.length > 0
      ? filtered.reduce((sum, item) => sum + fairOdds(item), 0) / filtered.length
      : null;

  return (
    <div className={styles.board}>
      <section className={styles.hero} aria-labelledby="member-home-title">
        <div className={styles.heroCopy}>
          <div className={styles.titleRow}>
            <span className={styles.calIcon}>
              <IconCal />
            </span>
            <h1 id="member-home-title">{t("Today's Predictions")}</h1>
          </div>
          <p className={styles.heroDate}>{formatLongDate(today)}</p>
          <p className={styles.disclaimer}>
            <IconInfo />
            <span>
              {t(
                "Match predictions prepared with our advanced statistical models. Predictions are for analysis; results are not guaranteed.",
              )}
            </span>
          </p>
        </div>
        <aside className={styles.heroAside}>
          <strong>
            {t("More Analysis")}
            <br />
            {t("Better Decisions")}
          </strong>
          <span>{t("Model-backed daily shortlist")}</span>
        </aside>
      </section>

      <section className={styles.statsRow} aria-label={t("Quick stats")}>
        <article className={styles.statCard}>
          <span className={styles.statIcon}>
            <IconCal />
          </span>
          <div>
            <small>{t("Today")}</small>
            <strong>
              {todayMatches.length} {t("matches")}
            </strong>
          </div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}>
            <IconDoc />
          </span>
          <div>
            <small>{t("Published predictions")}</small>
            <strong>
              {publishedToday.length} {t("matches")}
            </strong>
          </div>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statIcon}>
            <IconClock />
          </span>
          <div>
            <small>{t("Last update")}</small>
            <strong>{formatUpdate(updatedAtIso)}</strong>
          </div>
        </article>
        <article className={styles.freshCard}>
          <p>
            <i className={styles.freshDot} aria-hidden />
            {t("All predictions are current")}
          </p>
          <span>{t("Data refreshes regularly.")}</span>
        </article>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <section
            className={styles.filters}
            data-open={filtersOpen ? "true" : "false"}
            aria-label={t("Prediction filters")}
          >
            <label className={styles.field} data-keep="true">
              <span>{t("Date")}</span>
              <select
                value={draft.date}
                onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
              >
                <option value="ALL">{t("All dates")}</option>
                {dateOptions.map((key) => (
                  <option key={key} value={key}>
                    {key === today ? `${t("Today")} (${formatLongDate(key)})` : formatLongDate(key)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.mobileFilterToggle}
              aria-expanded={filtersOpen}
              aria-label={t("Filters")}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <IconFilter />
            </button>
            <label className={styles.field}>
              <span>{t("League")}</span>
              <select
                value={draft.league}
                onChange={(event) => setDraft((prev) => ({ ...prev, league: event.target.value }))}
              >
                <option value="ALL">{t("All Leagues")}</option>
                {leagues.map((item) => (
                  <option key={item.apiId} value={String(item.apiId)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{t("Market")}</span>
              <select
                value={draft.market}
                onChange={(event) => setDraft((prev) => ({ ...prev, market: event.target.value }))}
              >
                <option value="ALL">{t("All markets")}</option>
                {markets.map((market) => (
                  <option key={market} value={market}>
                    {translatePick(market)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{t("Confidence Score")}</span>
              <select
                value={draft.confidence}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    confidence: event.target.value as ConfidenceFilter,
                  }))
                }
              >
                <option value="ALL">{t("All")}</option>
                <option value="HIGH">{t("High")}</option>
                <option value="MED">{t("Medium")}</option>
                <option value="LOW">{t("Low")}</option>
              </select>
            </label>
            <button
              type="button"
              className={styles.clearBtn}
              disabled={!hasActiveFilters && !hasDraftDiff}
              onClick={clearFilters}
            >
              {t("Clear filters")}
            </button>
            <button type="button" className={styles.applyBtn} onClick={applyFilters}>
              <IconSearch />
              {t("Filter")}
            </button>
          </section>

          <div className={styles.list}>
            {pageItems.length ? (
              pageItems.map((item) => {
                const conf = confidenceMeta(item.confidenceScore);
                const odds = fairOdds(item);
                const probability = pickProbability(item);
                const chip = pickChip(item);
                return (
                  <article className={styles.card} key={item.matchId}>
                    <div className={styles.cardHead}>
                      <div className={styles.league}>
                        <span className={styles.leagueFlag}>{leagueFlagCode(item.leagueName)}</span>
                        <span>{item.leagueName}</span>
                      </div>
                      <time className={styles.kick} dateTime={asDate(item.kickoffAt).toISOString()}>
                        <IconClock size={14} />
                        {formatKickLabel(item.kickoffAt)}
                      </time>
                    </div>

                    <div className={styles.cardBody}>
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

                      <div className={styles.pickChip}>
                        <span>{t(chip.market)}</span>
                        <strong>{chip.tip}</strong>
                      </div>

                      <div className={styles.metric}>
                        <span>{t("Model probability")}</span>
                        {showOdds ? (
                          <>
                            <strong className={styles.probValue}>%{probability.toFixed(0)}</strong>
                            <span className={styles.bar} aria-hidden>
                              <i style={{ width: `${Math.min(100, Math.max(0, probability))}%` }} />
                            </span>
                          </>
                        ) : (
                          <span className={styles.lock}>—</span>
                        )}
                      </div>

                      <div className={styles.metric}>
                        <span>{t("Odds (decimal)")}</span>
                        {showOdds ? (
                          <strong className={styles.oddsValue}>{odds > 0 ? odds.toFixed(2) : "—"}</strong>
                        ) : (
                          <span className={styles.lock}>
                            <Link href={plansHref}>{LOCK_HINT.modelOdds}</Link>
                          </span>
                        )}
                      </div>

                      <div className={styles.metric}>
                        <span>{t("Confidence Score")}</span>
                        <span
                          className={`${styles.confPill} ${
                            conf.kind === "high"
                              ? styles.confHigh
                              : conf.kind === "med"
                                ? styles.confMed
                                : styles.confLow
                          }`}
                        >
                          {t(conf.label)}
                        </span>
                        <span className={styles.confMeter} aria-hidden>
                          {[1, 2, 3, 4, 5].map((step) => (
                            <i key={step} data-on={step <= conf.filled} />
                          ))}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardFoot}>
                      <p className={styles.analysis}>
                        <IconChart />
                        <span>{shortAnalysis(item)}</span>
                      </p>
                      <Link className={styles.analysisLink} href={matchHref(item.matchId)}>
                        {t("View match analysis")} →
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className={styles.empty}>{t("No matches match these filters.")}</div>
            )}
          </div>

          <footer className={styles.pager}>
            <span>
              {filtered.length
                ? `${Math.min(PAGE_SIZE, filtered.length - (safePage - 1) * PAGE_SIZE)} / ${filtered.length} ${t("matches")}`
                : t("No results.")}
            </span>
            {totalPages > 1 ? (
              <div className={styles.pages}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={safePage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  aria-label={t("Previous page")}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((value) => value === 1 || value === totalPages || Math.abs(value - safePage) <= 1)
                  .reduce<number[]>((acc, value, index, arr) => {
                    if (index > 0 && value - arr[index - 1]! > 1) acc.push(-value);
                    acc.push(value);
                    return acc;
                  }, [])
                  .map((value) =>
                    value < 0 ? (
                      <span key={`gap-${value}`}>…</span>
                    ) : (
                      <button
                        type="button"
                        key={value}
                        className={value === safePage ? styles.pageActive : styles.pageBtn}
                        onClick={() => setPage(value)}
                      >
                        {value}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  aria-label={t("Next page")}
                >
                  ›
                </button>
              </div>
            ) : null}
          </footer>

          {performance ? (
            <section className={styles.summary} aria-label={t("Performance summary")}>
              <div>
                <h3>{t("Performance summary")}</h3>
                <p>{t("Evaluated published picks across confidence bands.")}</p>
              </div>
              <div
                className={styles.ring}
                style={{ ["--pct" as string]: hitRate != null ? Math.round(hitRate) : 0 }}
              >
                {hitRate != null ? `%${hitRate.toFixed(0)}` : "—"}
              </div>
              <div className={styles.summaryStats}>
                <span>
                  {t("Evaluated")}: <strong>{evaluatedSamples}</strong>
                </span>
                <span>
                  {t("Average odds")}: <strong>{avgOdds != null ? avgOdds.toFixed(2) : "—"}</strong>
                </span>
              </div>
            </section>
          ) : null}
        </div>

        <aside className={styles.sideCol}>
          {strongest ? (
            <section className={`${styles.sideCard} ${styles.sideStrong}`}>
              <h2>{t("Today's strongest pick")}</h2>
              <div className={styles.sideMatch}>
                <TeamLogo src={strongest.homeTeamLogo} name={strongest.homeTeam} size={28} />
                <span>
                  {strongest.homeTeam} vs {strongest.awayTeam}
                </span>
                <TeamLogo src={strongest.awayTeamLogo} name={strongest.awayTeam} size={28} />
              </div>
              <div className={styles.sidePick}>
                <span>{t("Prediction")}</span>
                <strong>{translatePick(getPredictionLabel(strongest))}</strong>
              </div>
              <div className={styles.sideMeta}>
                {showOdds ? (
                  <>
                    <span className={styles.sideChip}>%{pickProbability(strongest).toFixed(0)}</span>
                    <span className={styles.sideChip}>{fairOdds(strongest).toFixed(2)}</span>
                  </>
                ) : null}
                <span className={styles.sideChip}>{t(confidenceMeta(strongest.confidenceScore).label)}</span>
              </div>
              <p className={styles.sideNote}>{shortAnalysis(strongest)}</p>
              <Link className={styles.sideLink} href={matchHref(strongest.matchId)}>
                {t("View match analysis")} →
              </Link>
            </section>
          ) : null}

          <section className={`${styles.sideCard} ${styles.sideCoupon}`}>
            <h2>{t("Today's coupon suggestion")}</h2>
            {couponLegs.length ? (
              <>
                <div className={styles.couponLegs}>
                  {couponLegs.map((leg) => (
                    <div className={styles.couponLeg} key={leg.matchId}>
                      <TeamLogo src={leg.homeTeamLogo} name={leg.homeTeam} size={24} />
                      <div>
                        <strong>
                          {leg.homeTeam} – {leg.awayTeam}
                        </strong>
                        <small>{translatePick(getPredictionLabel(leg))}</small>
                      </div>
                      <b>{showOdds && fairOdds(leg) > 0 ? fairOdds(leg).toFixed(2) : "—"}</b>
                    </div>
                  ))}
                </div>
                <div className={styles.couponTotal}>
                  <span>{t("Combined odds")}</span>
                  <strong>{showOdds ? couponOdds.toFixed(2) : "—"}</strong>
                </div>
                <Link className={styles.sideLink} href={couponsHref}>
                  {t("Review coupon")} →
                </Link>
              </>
            ) : (
              <p className={styles.sideNote}>{t("No coupon legs available right now.")}</p>
            )}
          </section>
        </aside>
      </div>

      <nav className={styles.bottomNav} aria-label={t("Member menu")}>
        <Link className={styles.bottomLink} href="/member" data-active="true">
          <IconHome />
          {t("Today's Predictions")}
        </Link>
        <Link className={styles.bottomLink} href="/member/predictions">
          <IconCal />
          {t("Match calendar")}
        </Link>
        <Link className={styles.bottomLink} href="/member/results">
          <IconTrophy />
          {t("Performance")}
        </Link>
      </nav>
    </div>
  );
}
