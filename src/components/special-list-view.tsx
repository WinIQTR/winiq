import Image from "next/image";
import Link from "next/link";

import { MatchFormTip } from "@/components/match-form-tip";
import { dayPartFilterLabel, type DayPartFilter } from "@/lib/daypart-filter";
import {
  SPECIAL_ODDS_BANDS,
  SPECIAL_PROB_MIN_CHIPS,
  confidenceLabel,
  type SpecialListCandidate,
  type SpecialListDataSource,
  type SpecialOddsBandId,
  type SpecialProbMinChip,
  type SpecialListRange,
} from "@/lib/special-list";

import styles from "./special-list-view.module.css";

export type SpecialListViewProps = {
  surface: "member" | "admin";
  action: string;
  range: SpecialListRange;
  market: string;
  marketOptions: Array<{ value: string; label: string }>;
  rows: SpecialListCandidate[];
  tipsByKey: Record<string, string | null>;
  source?: SpecialListDataSource;
  matchHref: (matchId: number) => string;
  labels: SpecialListLabels;
  locale?: "tr" | "en";
  /** Chip filters (URL: pMin / odds) */
  probMin?: SpecialProbMinChip | null;
  oddsBand?: SpecialOddsBandId | null;
  dayPart?: DayPartFilter;
  /** Admin-only extras preserved for filters */
  adminExtras?: {
    sortDate: boolean;
    sortProb: boolean;
    sortOdds: boolean;
    minProb: number | null;
    maxProb: number | null;
  };
};

export type SpecialListLabels = {
  eyebrow: string;
  title: string;
  lead: string;
  blurb: string;
  selectionCount: (n: number) => string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  matchDate: string;
  betType: string;
  todayMatches: string;
  weekMatches: string;
  showList: string;
  foundCount: (n: number) => string;
  sectionToday: string;
  sectionWeek: string;
  probabilityNote: string;
  betTypeCol: string;
  selectionCol: string;
  modelPrediction: string;
  odds: string;
  viewAnalysis: string;
  empty: string;
  confVeryHigh: string;
  confHigh: string;
  confMedium: string;
  confLow: string;
  sortByDate: string;
  sortByProb: string;
  sortByOdds: string;
  minProb: string;
  maxProb: string;
  snapshotNote: string;
  liveNote: string;
  minModelPct: string;
  oddsRange: string;
  filterAll: string;
  probAtLeast: (n: number) => string;
  oddsLt120: string;
  odds120160: string;
  odds160190: string;
  odds190250: string;
  odds250300: string;
  odds300p: string;
  specialListFilters: string;
  matchDayPart: string;
};

function formatKickoff(value: Date, locale: "tr" | "en") {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(value);
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <Image className={styles.logo} src={src} alt="" width={34} height={34} />;
  }
  return <span className={styles.logoFallback}>{name.slice(0, 2).toUpperCase()}</span>;
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconBall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5l2.2 4.2 4.7.6-3.5 3.3.9 4.7L12 14.2 7.7 16.3l.9-4.7-3.5-3.3 4.7-.6L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 18V11M12 18V6M19 18v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function confText(level: ReturnType<typeof confidenceLabel>, labels: SpecialListLabels) {
  if (level === "very-high") return labels.confVeryHigh;
  if (level === "high") return labels.confHigh;
  if (level === "medium") return labels.confMedium;
  return labels.confLow;
}

function rowKey(item: SpecialListCandidate) {
  return `${item.prediction.matchId}|${item.marketKey}|${item.selection}`;
}

function oddsBandLabel(id: SpecialOddsBandId, labels: SpecialListLabels) {
  switch (id) {
    case "lt120":
      return labels.oddsLt120;
    case "120_160":
      return labels.odds120160;
    case "160_190":
      return labels.odds160190;
    case "190_250":
      return labels.odds190250;
    case "250_300":
      return labels.odds250300;
    case "300p":
      return labels.odds300p;
  }
}

function buildChipHref(
  action: string,
  base: Record<string, string | null | undefined>,
  patch: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...patch })) {
    if (value != null && value !== "") params.set(key, value);
  }
  const text = params.toString();
  return text ? `${action}?${text}` : action;
}

export function SpecialListView({
  surface,
  action,
  range,
  market,
  marketOptions,
  rows,
  tipsByKey,
  source,
  matchHref,
  labels,
  locale = "tr",
  probMin = null,
  oddsBand = null,
  dayPart = "ALL",
  adminExtras,
}: SpecialListViewProps) {
  const sectionTitle = range === "week" ? labels.sectionWeek : labels.sectionToday;
  const queryBase: Record<string, string | null | undefined> = {
    range,
    market,
    daypart: dayPart !== "ALL" ? dayPart : null,
    pMin: probMin != null ? String(probMin) : null,
    odds: oddsBand,
    sortDate: adminExtras?.sortDate ? "1" : null,
    sortProb: adminExtras?.sortProb ? "1" : null,
    sortOdds: adminExtras?.sortOdds ? "1" : null,
    minProb:
      adminExtras?.minProb != null && !Number.isNaN(adminExtras.minProb)
        ? String(adminExtras.minProb)
        : null,
    maxProb:
      adminExtras?.maxProb != null && !Number.isNaN(adminExtras.maxProb)
        ? String(adminExtras.maxProb)
        : null,
  };

  return (
    <div className={styles.root} data-surface={surface}>
      <section className={styles.hero} aria-label={labels.title}>
        <div className={styles.heroVisual} aria-hidden>
          <div className={styles.heroPitch} />
          <div className={styles.heroBall} />
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow} data-no-translate>
            {labels.eyebrow}
          </p>
          <h1 data-no-translate>{labels.title}</h1>
          <p className={styles.lead}>{labels.lead}</p>
          <p className={styles.blurb}>{labels.blurb}</p>
        </div>
        <div className={styles.heroAside}>
          <div className={styles.countCard}>
            <IconTarget />
            <span>{labels.selectionCount(rows.length)}</span>
          </div>
          <ul className={styles.benefits}>
            <li>
              <IconCheck />
              <span>{labels.benefit1}</span>
            </li>
            <li>
              <IconCheck />
              <span>{labels.benefit2}</span>
            </li>
            <li>
              <IconCheck />
              <span>{labels.benefit3}</span>
            </li>
          </ul>
        </div>
      </section>

      <form className={styles.filters} method="get" action={action}>
        {probMin != null ? <input type="hidden" name="pMin" value={probMin} /> : null}
        {oddsBand ? <input type="hidden" name="odds" value={oddsBand} /> : null}
        <div className={styles.field}>
          <label htmlFor="sl-range">{labels.matchDate}</label>
          <div className={styles.selectWrap}>
            <IconCalendar />
            <select id="sl-range" name="range" defaultValue={range}>
              <option value="day">{labels.todayMatches}</option>
              <option value="week">{labels.weekMatches}</option>
            </select>
            <IconChevron />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="sl-daypart">{labels.matchDayPart}</label>
          <div className={styles.selectWrap}>
            <IconCalendar />
            <select id="sl-daypart" name="daypart" defaultValue={dayPart}>
              <option value="ALL">{labels.filterAll}</option>
              <option value="day">{dayPartFilterLabel("day", locale === "en" ? "en" : "tr")}</option>
              <option value="night">{dayPartFilterLabel("night", locale === "en" ? "en" : "tr")}</option>
            </select>
            <IconChevron />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="sl-market">{labels.betType}</label>
          <div className={styles.selectWrap}>
            <IconBall />
            <select id="sl-market" name="market" defaultValue={market}>
              {marketOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <IconChevron />
          </div>
        </div>
        <button className={styles.submit} type="submit">
          {labels.showList}
        </button>
        <span className={styles.found}>{labels.foundCount(rows.length)}</span>

        {adminExtras ? (
          <div className={styles.adminExtras}>
            <label>
              <input type="checkbox" name="sortDate" value="1" defaultChecked={adminExtras.sortDate} />
              {labels.sortByDate}
            </label>
            <label>
              <input type="checkbox" name="sortProb" value="1" defaultChecked={adminExtras.sortProb} />
              {labels.sortByProb}
            </label>
            <label>
              <input type="checkbox" name="sortOdds" value="1" defaultChecked={adminExtras.sortOdds} />
              {labels.sortByOdds}
            </label>
            <label>
              {labels.minProb}
              <input
                type="number"
                name="minProb"
                min={0}
                max={100}
                step={1}
                defaultValue={adminExtras.minProb ?? ""}
              />
            </label>
            <label>
              {labels.maxProb}
              <input
                type="number"
                name="maxProb"
                min={0}
                max={100}
                step={1}
                defaultValue={adminExtras.maxProb ?? ""}
              />
            </label>
          </div>
        ) : null}
      </form>

      <section className={styles.chipPanel} aria-label={labels.specialListFilters}>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>{labels.matchDayPart}</span>
          <div className={styles.chips} role="group" aria-label={labels.matchDayPart}>
            <Link
              className={styles.chip}
              data-active={dayPart === "ALL" ? "true" : undefined}
              href={buildChipHref(action, queryBase, { daypart: null })}
              scroll={false}
            >
              {labels.filterAll}
            </Link>
            <Link
              className={styles.chip}
              data-active={dayPart === "day" ? "true" : undefined}
              href={buildChipHref(action, queryBase, { daypart: "day" })}
              scroll={false}
            >
              {dayPartFilterLabel("day", locale === "en" ? "en" : "tr")}
            </Link>
            <Link
              className={styles.chip}
              data-active={dayPart === "night" ? "true" : undefined}
              href={buildChipHref(action, queryBase, { daypart: "night" })}
              scroll={false}
            >
              {dayPartFilterLabel("night", locale === "en" ? "en" : "tr")}
            </Link>
          </div>
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>{labels.minModelPct}</span>
          <div className={styles.chips} role="group" aria-label={labels.minModelPct}>
            <Link
              className={styles.chip}
              data-active={probMin == null ? "true" : undefined}
              href={buildChipHref(action, queryBase, { pMin: null })}
              scroll={false}
            >
              {labels.filterAll}
            </Link>
            {SPECIAL_PROB_MIN_CHIPS.map((value) => (
              <Link
                key={value}
                className={styles.chip}
                data-active={probMin === value ? "true" : undefined}
                href={buildChipHref(action, queryBase, { pMin: String(value) })}
                scroll={false}
              >
                {labels.probAtLeast(value)}
              </Link>
            ))}
          </div>
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>{labels.oddsRange}</span>
          <div className={styles.chips} role="group" aria-label={labels.oddsRange}>
            <Link
              className={styles.chip}
              data-active={oddsBand == null ? "true" : undefined}
              href={buildChipHref(action, queryBase, { odds: null })}
              scroll={false}
            >
              {labels.filterAll}
            </Link>
            {SPECIAL_ODDS_BANDS.map((band) => (
              <Link
                key={band.id}
                className={styles.chip}
                data-active={oddsBand === band.id ? "true" : undefined}
                href={buildChipHref(action, queryBase, { odds: band.id })}
                scroll={false}
              >
                {oddsBandLabel(band.id, labels)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {source ? (
        <p className={styles.sourceNote}>
          {source === "SNAPSHOT" ? labels.snapshotNote : labels.liveNote}
        </p>
      ) : null}

      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <div>
            <h2>
              <IconBars />
              {sectionTitle}
            </h2>
            <p>{labels.probabilityNote}</p>
          </div>
        </header>

        <div className={styles.list}>
          {rows.length ? (
            rows.map((item, index) => {
              const key = rowKey(item);
              const level = confidenceLabel(item.prediction.confidenceScore);
              const tip = tipsByKey[key] ?? null;
              const kick = formatKickoff(item.prediction.kickoffAt, locale === "en" ? "en" : "tr");
              return (
                <article className={styles.row} key={key}>
                  <b className={styles.rank}>{index + 1}</b>
                  <div className={styles.meta}>
                    <small>{item.prediction.leagueName}</small>
                    <time dateTime={item.prediction.kickoffAt.toISOString()}>{kick}</time>
                  </div>
                  <div className={styles.teams}>
                    <div className={styles.teamPair}>
                      <TeamLogo
                        src={item.prediction.homeTeamLogo}
                        name={item.prediction.homeTeam}
                      />
                      <span className={styles.vs}>VS</span>
                      <TeamLogo
                        src={item.prediction.awayTeamLogo}
                        name={item.prediction.awayTeam}
                      />
                    </div>
                    <div className={styles.teamNames}>
                      {item.prediction.homeTeam} · {item.prediction.awayTeam}
                    </div>
                  </div>
                  <div className={styles.pick}>
                    <span>{labels.betTypeCol}</span>
                    <b>{item.marketLabel}</b>
                    <span>{labels.selectionCol}</span>
                    <strong>{item.selection}</strong>
                  </div>
                  <div className={styles.model}>
                    <span>{labels.modelPrediction}</span>
                    <strong>%{item.probability.toFixed(1)}</strong>
                    <span className={styles.conf} data-level={level}>
                      <IconBars />
                      {confText(level, labels)}
                    </span>
                  </div>
                  <span className={`${styles.conf} ${styles.confMobile}`} data-level={level}>
                    <IconBars />
                    {confText(level, labels)}
                  </span>
                  <div className={styles.odds}>
                    <span>{labels.odds}</span>
                    <strong>{item.fairOdds.toFixed(2)}</strong>
                  </div>
                  <div className={styles.tipWrap}>
                    <MatchFormTip tip={tip} />
                  </div>
                  <Link className={styles.analyze} href={matchHref(item.prediction.matchId)}>
                    {labels.viewAnalysis}
                  </Link>
                </article>
              );
            })
          ) : (
            <p className={styles.empty}>{labels.empty}</p>
          )}
        </div>
      </section>
    </div>
  );
}

/** English source strings — LanguageProvider maps them via dictionaries (TR/EN). */
export function buildSpecialListLabels(_locale: "tr" | "en" = "en"): SpecialListLabels {
  return {
    eyebrow: "WINIQ · SPECIAL LIST",
    title: "Special List",
    lead: "Our AI model's highest-probability match picks.",
    blurb:
      "A data-driven shortlist of the strongest model selections for faster analysis.",
    selectionCount: (n) => `${n} selections`,
    benefit1: "Highest-probability matches from the model",
    benefit2: "Analysis based on current form and stats",
    benefit3: "Faster, easier match analysis",
    matchDate: "Match date",
    betType: "Bet type",
    todayMatches: "Today's matches",
    weekMatches: "This week's matches",
    showList: "Show list →",
    foundCount: (n) => `${n} selections found`,
    sectionToday: "Today's matches",
    sectionWeek: "This week's matches",
    probabilityNote: "Probability values are model estimates, not guarantees.",
    betTypeCol: "Bet type",
    selectionCol: "Selection",
    modelPrediction: "Model forecast",
    odds: "Odds",
    viewAnalysis: "View match analysis →",
    empty: "No picks found for this period and bet type.",
    confVeryHigh: "Very high confidence",
    confHigh: "High confidence",
    confMedium: "Medium confidence",
    confLow: "Lower confidence",
    sortByDate: "Sort by date",
    sortByProb: "Sort by probability",
    sortByOdds: "Sort by fair odds",
    minProb: "Min. %",
    maxProb: "Max. %",
    snapshotNote: "Data source: snapshot backup",
    liveNote: "Data source: live cache",
    minModelPct: "Minimum model %",
    oddsRange: "Odds range",
    filterAll: "All",
    probAtLeast: (n) => `≥${n}%`,
    oddsLt120: "Under 1.20",
    odds120160: "1.20–1.60",
    odds160190: "1.60–1.90",
    odds190250: "1.90–2.50",
    odds250300: "2.50–3.00",
    odds300p: "3.00+",
    specialListFilters: "Special List filters",
    matchDayPart: "Match day part",
  };
}
