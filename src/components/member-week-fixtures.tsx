"use client";

import Image from "next/image";
import Link from "next/link";

import { FormResultBadge } from "@/components/form-result-badge";
import { useLanguage } from "@/components/language-provider";
import { MatchFormTip } from "@/components/match-form-tip";
import { LeagueMark } from "@/lib/league-marks";
import { dayPartLabel, getMatchDayPart } from "@/lib/match-daypart";
import type { MatchWeatherSummary } from "@/lib/match-weather";
import type { RefereeProfile, RefereeStyleTone } from "@/lib/referee-profile";
import { slugifyRefereeName } from "@/lib/referee-profile";

import styles from "./member-week-fixtures.module.css";

export type WeekFixtureRow = {
  id: number;
  kickoffAt: Date;
  referee: string | null;
  refereeProfile: Pick<
    RefereeProfile,
    "matches" | "averageCards" | "style" | "styleLabel"
  > | null;
  venueName: string | null;
  venueCapacity: number | null;
  leagueName: string;
  leagueApiId: number | null;
  leagueLogoUrl: string | null;
  formTip?: string | null;
  home: {
    id: number;
    name: string;
    logoUrl: string | null;
    form: Array<"W" | "D" | "L">;
    homeForm?: Array<"W" | "D" | "L">;
    isLeader: boolean;
    isHot: boolean;
    favoritePct: number | null;
  };
  away: {
    id: number;
    name: string;
    logoUrl: string | null;
    form: Array<"W" | "D" | "L">;
    awayForm?: Array<"W" | "D" | "L">;
    isLeader: boolean;
    isHot: boolean;
    favoritePct: number | null;
  };
  weather: MatchWeatherSummary | null;
};

function formatKickoffParts(date: Date, locale: "tr" | "en") {
  const lang = locale === "tr" ? "tr-TR" : "en-GB";
  const dayMonth = new Intl.DateTimeFormat(lang, {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat(lang, {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const weekday = new Intl.DateTimeFormat(lang, {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  }).format(date);
  return { dayMonth, time, weekday };
}

function FormDots({
  results,
  locale,
}: {
  results: Array<"W" | "D" | "L">;
  locale: "tr" | "en";
}) {
  return (
    <span className={styles.form} aria-label="Form">
      <FormResultBadge results={results} locale={locale} max={5} fillMissing />
    </span>
  );
}

function WeatherIcon({ icon }: { icon: MatchWeatherSummary["icon"] }) {
  if (icon === "sun") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 2v2.2M12 19.8V22M4.2 12H2M22 12h-2.2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (icon === "rain") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 15a4 4 0 0 1 .3-7.9A5.2 5.2 0 0 1 17.5 9 3.5 3.5 0 0 1 18 16H7.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 16a4 4 0 0 1 .3-7.9A5.2 5.2 0 0 1 17.5 10 3.5 3.5 0 0 1 18 17H7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FanIcon() {
  return (
    <svg className={styles.fanIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8c2.8 3.4 4.2 5.8 4.2 8.1A4.2 4.2 0 0 1 12 15.1 4.2 4.2 0 0 1 7.8 10.9C7.8 8.6 9.2 6.2 12 2.8z"
        fill="currentColor"
      />
      <path
        d="M12 15.1c1.5 0 2.7 1.1 2.7 2.6 0 1.8-1.4 3.5-2.7 3.5s-2.7-1.7-2.7-3.5c0-1.5 1.2-2.6 2.7-2.6z"
        fill="#ffd1a1"
        opacity="0.9"
      />
    </svg>
  );
}

function styleClass(tone: RefereeStyleTone | undefined) {
  if (tone === "hard") return styles.styleHard;
  if (tone === "soft") return styles.styleSoft;
  if (tone === "lenient") return styles.styleLenient;
  return styles.styleUnknown;
}

function TeamBlock({
  team,
  locale,
  t,
}: {
  team: WeekFixtureRow["home"];
  locale: "tr" | "en";
  t: (source: string) => string;
}) {
  return (
    <div className={styles.team}>
      <div className={styles.teamHead}>
        {team.logoUrl ? (
          <Image src={team.logoUrl} alt="" width={36} height={36} />
        ) : (
          <span className={styles.logoFallback} />
        )}
        <div className={styles.teamMeta}>
          <b title={team.name}>{team.name}</b>
          <div className={styles.badges}>
            {team.isLeader ? <em className={styles.leader}>★ {t("Leader")}</em> : null}
            {team.isHot ? (
              <em className={styles.hot} title={t("Club with a strong fan atmosphere")}>
                🔥
              </em>
            ) : null}
            {team.favoritePct != null ? (
              <em className={styles.favorite}>
                ◆ {t("Favourite")} %{team.favoritePct.toFixed(0)}
              </em>
            ) : null}
          </div>
        </div>
      </div>
      <FormDots results={team.form} locale={locale} />
    </div>
  );
}

export function MemberWeekFixtures({
  title,
  rangeLabel,
  rows,
}: {
  title: string;
  rangeLabel: string;
  rows: WeekFixtureRow[];
}) {
  const { locale, t } = useLanguage();
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.calendarIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2>{title}</h2>
            <small>{rangeLabel}</small>
          </div>
        </div>
        <span className={styles.countChip}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 8v8M9 11l6 2M9 13l6-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {rows.length} {t("fixtures count")}
        </span>
      </header>

      <div className={styles.list}>
        {rows.length === 0 ? (
          <div className={styles.empty}>{t("No matches found for this week.")}</div>
        ) : (
          rows.map((row) => {
            const stadium = row.venueName ?? t("Stadium pending");
            const capacity = row.venueCapacity
              ? `${row.venueCapacity.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB")} ${t("people")}`
              : null;
            const referee = row.referee?.trim() || null;
            const profile = row.refereeProfile;
            const weather = row.weather;
            const dayPart = getMatchDayPart(row.kickoffAt);
            const { dayMonth, time, weekday } = formatKickoffParts(row.kickoffAt, locale);
            const refereeHref = referee
              ? `/member/referees/${encodeURIComponent(slugifyRefereeName(referee))}`
              : null;

            return (
              <article className={styles.row} key={row.id}>
                <div className={styles.leagueCol}>
                  <div className={styles.leagueHead}>
                    <LeagueMark
                      apiId={row.leagueApiId}
                      name={row.leagueName}
                      logoUrl={row.leagueLogoUrl}
                      className={styles.leagueMark}
                    />
                    <span title={row.leagueName}>{row.leagueName}</span>
                  </div>
                  <div className={styles.dateBlock}>
                    <strong className={styles.dateDay}>{dayMonth}</strong>
                    <b className={styles.dateTime}>{time}</b>
                  </div>
                  <small className={styles.weekday}>{weekday}</small>
                </div>

                <div className={styles.matchup}>
                  <TeamBlock team={row.home} locale={locale} t={t} />
                  <i className={styles.vs}>VS</i>
                  <TeamBlock team={row.away} locale={locale} t={t} />
                </div>

                <div className={styles.metaCols}>
                  <div className={styles.meta}>
                    <span className={styles.metaIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M4 10V8l8-4 8 4v2M6 10v8M18 10v8M3 18h18M9 18v-4h6v4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className={styles.metaCopy}>
                      <small>{t("Stadium")}</small>
                      <b title={stadium}>{stadium}</b>
                      {capacity ? (
                        <em className={styles.capacity}>
                          <FanIcon />
                          {capacity}
                        </em>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.metaIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M8 14c2 3 6 3 8 0M7 9h.01M17 9h.01M12 4v2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                        <circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                    <div className={styles.metaCopy}>
                      <small>{t("Referee")}</small>
                      {referee && refereeHref ? (
                        <Link className={styles.refereeLink} href={refereeHref} title={referee}>
                          {referee}
                        </Link>
                      ) : (
                        <b className={styles.pending}>{t("Assignment not announced yet")}</b>
                      )}
                      {referee ? (
                        profile && profile.matches > 0 && profile.averageCards != null ? (
                          <em className={`${styles.refereeMeta} ${styleClass(profile.style)}`}>
                            {locale === "en" ? profile.styleLabel.en : profile.styleLabel.tr}
                            {" · "}
                            {profile.averageCards.toFixed(1)} {t("cards/match")}
                            {" · "}
                            {profile.matches} {t("matches")}
                          </em>
                        ) : (
                          <em className={`${styles.refereeMeta} ${styles.styleUnknown}`}>
                            {t("Profile pending")}
                          </em>
                        )
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.metaIcon} aria-hidden="true">
                      <WeatherIcon icon={weather?.icon ?? "cloud"} />
                    </span>
                    <div className={styles.metaCopy}>
                      <small>{t("Weather")}</small>
                      <b className={weather ? undefined : styles.pending} title={weather?.text ?? undefined}>
                        {weather?.text ?? t("Forecast updates closer to match day")}
                      </b>
                      <em className={styles.dayPart} data-part={dayPart}>
                        {dayPartLabel(dayPart, locale)}
                      </em>
                    </div>
                  </div>
                </div>

                <MatchFormTip className={styles.formTip} tip={row.formTip} />
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
