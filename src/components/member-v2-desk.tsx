"use client";

import Image from "next/image";
import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { MarketLineMoveBlock } from "@/components/market-line-move";
import type { MemberV2DeskBundle } from "@/lib/member-v2-desk";
import { probabilityTone } from "@/lib/probability-tone";

import styles from "./member-v2-desk.module.css";

function TeamMark({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <Image className={styles.logo} src={src} alt="" width={36} height={36} />
    );
  }
  return (
    <span className={`${styles.logo} ${styles.logoFall}`} aria-hidden>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function IconPeople() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.5 18.5c.6-3 2.7-4.5 4.5-4.5s3.9 1.5 4.5 4.5M14 14.2c1.4.2 2.9 1.2 3.5 3.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19V10M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconBall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8v4.2l2.6 1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MemberV2Desk({ desk }: { desk: MemberV2DeskBundle }) {
  const { t, locale } = useLanguage();
  const lang = locale === "tr" ? "tr-TR" : "en-GB";

  return (
    <section className={styles.desk} aria-labelledby="member-v2-desk-title">
      <div className={styles.head}>
        <div>
          <small data-no-translate>WINIQ V3</small>
          <h2 id="member-v2-desk-title">{t("Today's clear three")}</h2>
          <p>{t("Decide first — then browse the full board.")}</p>
        </div>
        <div className={styles.trust}>
          <article>
            <span className={styles.trustIcon}>
              <IconPeople />
            </span>
            <div>
              <span>{t("Pre-kickoff log")}</span>
              <strong>
                {desk.trust.loggedBeforeKickoffPct == null
                  ? "—"
                  : `%${desk.trust.loggedBeforeKickoffPct.toFixed(0)}`}
              </strong>
            </div>
          </article>
          <article>
            <span className={styles.trustIcon}>
              <IconBars />
            </span>
            <div>
              <span>{t("Recent form")}</span>
              <strong>
                {desk.trust.recentHitRate == null
                  ? "—"
                  : `%${desk.trust.recentHitRate.toFixed(0)}`}
              </strong>
              <em>{t(desk.trust.recentStreakLabel)}</em>
            </div>
          </article>
          <article>
            <span className={styles.trustIcon}>
              <IconTarget />
            </span>
            <div>
              <span>{t("Vs home baseline")}</span>
              <strong>
                {desk.trust.baselineBeat == null
                  ? "—"
                  : desk.trust.baselineBeat
                    ? t("Ahead")
                    : t("Behind")}
              </strong>
            </div>
          </article>
        </div>
      </div>

      <div className={styles.topGrid}>
        {desk.topPicks.length ? (
          desk.topPicks.map((pick, index) => {
            const tone = probabilityTone(pick.confidence);
            const kick = new Date(pick.kickoffIso);
            const time = new Intl.DateTimeFormat(lang, {
              timeZone: "Europe/Istanbul",
              hour: "2-digit",
              minute: "2-digit",
            }).format(kick);
            return (
              <article className={styles.topCard} key={pick.matchId}>
                <div className={styles.topRank}>
                  <IconTrophy />
                  <span>#{index + 1}</span>
                </div>

                <div className={styles.topMatch}>
                  <TeamMark src={pick.homeTeamLogo} name={pick.homeTeam} />
                  <strong>
                    {pick.homeTeam} vs {pick.awayTeam}
                  </strong>
                  <TeamMark src={pick.awayTeamLogo} name={pick.awayTeam} />
                </div>

                <div className={styles.metaLine}>
                  <span>
                    <IconBall />
                    {pick.leagueName}
                  </span>
                  <i aria-hidden />
                  <span>
                    <IconClock />
                    {time}
                  </span>
                </div>

                <div className={styles.pickBox}>
                  <div>
                    <span>{t("Market code")}</span>
                    <strong>{pick.market}</strong>
                  </div>
                  <div>
                    <span>{t("Prediction")}</span>
                    <strong>{pick.selection}</strong>
                  </div>
                </div>

                <div className={styles.statsRow} data-tone={tone}>
                  <div className={styles.confBlock}>
                    <span>{t("Confidence")}</span>
                    <div className={styles.confMeter}>
                      <span className={styles.bar} aria-hidden>
                        <i style={{ width: `${Math.max(4, pick.confidence)}%` }} />
                      </span>
                      <b>%{pick.confidence.toFixed(0)}</b>
                    </div>
                  </div>
                  <span className={styles.statsSep} aria-hidden />
                  <div className={styles.oddsBlock}>
                    <span>{t("Odds")}</span>
                    <em data-no-translate>
                      {pick.fairOdds != null ? pick.fairOdds.toFixed(2) : "—"}
                    </em>
                  </div>
                </div>

                <div className={styles.bandRow}>
                  <IconTarget />
                  <span>
                    {t("Odds range")}: {pick.oddsBand}
                  </span>
                </div>

                {pick.lineMove ? (
                  <div className={styles.lineRow}>
                    <MarketLineMoveBlock move={pick.lineMove} />
                    {pick.marketJoined ? (
                      <span className={styles.joined}>{t("Market joined")}</span>
                    ) : null}
                  </div>
                ) : null}

                <Link className={styles.cta} href={pick.href}>
                  {t("Open analysis")} →
                </Link>
              </article>
            );
          })
        ) : (
          <p className={styles.empty}>{t("No clear top picks yet for today.")}</p>
        )}
      </div>

      {desk.skipToday.length > 0 ? (
        <div className={styles.skipBox}>
          <h3>{t("Do not play today")}</h3>
          <p>{t("Low-confidence or no-bet calls — skipping is part of the edge.")}</p>
          <ul>
            {desk.skipToday.map((item) => (
              <li key={item.matchId}>
                <Link href={item.href}>
                  {item.homeTeam} vs {item.awayTeam}
                </Link>
                <span>{item.leagueName}</span>
                <em>{t(item.reason)}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
