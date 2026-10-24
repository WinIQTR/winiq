"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";
import {
  getPredictionLabel,
  getUiConfidence,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";
import { buildMatchCardInsight, localizePickText } from "@/lib/member-match-insight";
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

type BoardPick = {
  market: string;
  selection: string;
  probability: number;
  fairOdds: number | null;
};

/** Markets available on a match — topPicks + supported popular summary (same sources as Special List). */
function collectMatchMarkets(prediction: DashboardPrediction): string[] {
  const names = new Set<string>();
  for (const pick of prediction.topPicks ?? []) {
    if (pick.market) names.add(pick.market);
  }
  for (const row of prediction.popularMarketsSummary ?? []) {
    if (row.supported === false || !row.market) continue;
    names.add(row.market);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "en"));
}

function resolvePrimaryPick(
  prediction: DashboardPrediction,
  preferredMarket?: string,
): BoardPick | null {
  const preferred =
    preferredMarket && preferredMarket !== "ALL" ? preferredMarket : null;

  if (preferred) {
    const fromTop = (prediction.topPicks ?? []).find((pick) => pick.market === preferred);
    if (fromTop) {
      return {
        market: fromTop.market,
        selection: fromTop.selection,
        probability: fromTop.probability,
        fairOdds: fromTop.fairOdds,
      };
    }
    const fromPopular = (prediction.popularMarketsSummary ?? []).find(
      (row) =>
        row.supported !== false &&
        row.market === preferred &&
        typeof row.probability === "number" &&
        !!row.selection,
    );
    if (fromPopular?.market && fromPopular.selection && fromPopular.probability != null) {
      return {
        market: fromPopular.market,
        selection: fromPopular.selection,
        probability: fromPopular.probability,
        fairOdds: fromPopular.fairOdds ?? null,
      };
    }
  }

  const top = prediction.topPicks[0];
  if (top) {
    return {
      market: top.market,
      selection: top.selection,
      probability: top.probability,
      fairOdds: top.fairOdds,
    };
  }
  return null;
}

function fairOdds(prediction: DashboardPrediction, preferredMarket?: string) {
  const pick = resolvePrimaryPick(prediction, preferredMarket);
  if (pick?.fairOdds && pick.fairOdds > 0) return pick.fairOdds;
  if (pick && pick.probability > 0) return 100 / pick.probability;
  return prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
}

function pickProbability(prediction: DashboardPrediction, preferredMarket?: string) {
  return (
    resolvePrimaryPick(prediction, preferredMarket)?.probability ?? prediction.predictedProbability
  );
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

function marketLabelKey(marketRaw: string) {
  if (/total\s*goals/i.test(marketRaw)) return "Total Goals";
  if (/match\s*result|1x2|full\s*time/i.test(marketRaw)) return "Match result";
  if (/both\s*teams\s*to\s*score|karşılıklı/i.test(marketRaw)) return "Both Teams To Score";
  if (/double\s*chance|çifte\s*şans/i.test(marketRaw)) return "Double Chance";
  if (/draw\s*no\s*bet|beraberlikte\s*(iade|bahis\s*yok)/i.test(marketRaw)) return "Draw No Bet";
  if (/asian\s*handicap|handikap/i.test(marketRaw)) return "Asian Handicap";
  if (/win\s*to\s*nil|gol\s*yemez/i.test(marketRaw)) return "Win To Nil";
  if (/correct\s*score|kesin\s*skor/i.test(marketRaw)) return "Correct Score";
  return marketRaw;
}

function pickChip(
  prediction: DashboardPrediction,
  locale: "en" | "tr",
  t: (source: string) => string,
  preferredMarket?: string,
) {
  const top = resolvePrimaryPick(prediction, preferredMarket);
  if (top) {
    const marketKey = marketLabelKey(top.market || "Match result");
    const translated = t(marketKey);
    return {
      market: localizePickText(
        translated !== marketKey ? translated : top.market || marketKey,
        locale,
        t,
      ),
      tip: localizePickText(top.selection || getPredictionLabel(prediction), locale, t),
    };
  }
  if (prediction.predictedOutcome === "HOME") {
    return { market: t("Match result"), tip: `1 (${prediction.homeTeam})` };
  }
  if (prediction.predictedOutcome === "AWAY") {
    return { market: t("Match result"), tip: `2 (${prediction.awayTeam})` };
  }
  return { market: t("Match result"), tip: "X" };
}

const MARKETS_STRIP_LIMIT = 8;

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
      for (const market of collectMatchMarkets(item)) names.add(market);
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
      if (applied.market !== "ALL" && !collectMatchMarkets(item).includes(applied.market)) {
        return false;
      }
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
    const odds = fairOdds(item, applied.market);
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
      ? filtered.reduce((sum, item) => sum + fairOdds(item, applied.market), 0) / filtered.length
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
                    {localizePickText(market, locale, t)}
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
                const odds = fairOdds(item, applied.market);
                const probability = pickProbability(item, applied.market);
                const chip = pickChip(item, locale, t, applied.market);
                const insight = buildMatchCardInsight(item, t, locale);
                const matchMarkets = collectMatchMarkets(item);
                const primaryMarket =
                  resolvePrimaryPick(item, applied.market)?.market ?? matchMarkets[0] ?? "";
                const otherMarkets = matchMarkets.filter((market) => market !== primaryMarket);
                const visibleMarkets = otherMarkets.slice(0, MARKETS_STRIP_LIMIT);
                const hiddenMarketCount = Math.max(0, otherMarkets.length - visibleMarkets.length);
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
                        <span>{chip.market}</span>
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

                    {matchMarkets.length > 1 ? (
                      <div className={styles.marketsStrip} aria-label={t("Other markets")}>
                        <div className={styles.marketsStripHead}>
                          <span>{t("Other markets")}</span>
                          <strong>
                            {matchMarkets.length}/{BET_MARKET_COUNT}
                          </strong>
                        </div>
                        <ul className={styles.marketsChips}>
                          {visibleMarkets.map((market) => (
                            <li key={market}>
                              <button
                                type="button"
                                className={styles.marketChip}
                                onClick={() => {
                                  setDraft((prev) => ({ ...prev, market }));
                                  setApplied((prev) => ({ ...prev, market }));
                                  setPage(1);
                                }}
                              >
                                {localizePickText(market, locale, t)}
                              </button>
                            </li>
                          ))}
                          {hiddenMarketCount > 0 ? (
                            <li>
                              <Link className={styles.marketMore} href={matchHref(item.matchId)}>
                                +{hiddenMarketCount}
                              </Link>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    ) : null}

                    <div className={styles.cardFoot}>
                      <p className={styles.analysis}>
                        <IconChart />
                        <span>{insight}</span>
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
                <strong>{localizePickText(getPredictionLabel(strongest), locale, t)}</strong>
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
              <p className={styles.sideNote}>{buildMatchCardInsight(strongest, t, locale)}</p>
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
                        <small>{localizePickText(getPredictionLabel(leg), locale, t)}</small>
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
