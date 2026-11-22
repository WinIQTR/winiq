"use client";

import Link from "next/link";

import { useLanguage } from "@/components/language-provider";
import { MarketLineMoveBlock } from "@/components/market-line-move";
import type { MemberV2DeskBundle } from "@/lib/member-v2-desk";

import styles from "./member-v2-desk.module.css";

export function MemberV2Desk({ desk }: { desk: MemberV2DeskBundle }) {
  const { t, locale } = useLanguage();
  const lang = locale === "tr" ? "tr-TR" : "en-GB";

  return (
    <section className={styles.desk} aria-labelledby="member-v2-desk-title">
      <div className={styles.head}>
        <div>
          <small data-no-translate>WINIQ V2</small>
          <h2 id="member-v2-desk-title">{t("Today's clear three")}</h2>
          <p>{t("Decide first — then browse the full board.")}</p>
        </div>
        <div className={styles.trust}>
          <article>
            <span>{t("Pre-kickoff log")}</span>
            <strong>
              {desk.trust.loggedBeforeKickoffPct == null
                ? "—"
                : `%${desk.trust.loggedBeforeKickoffPct.toFixed(0)}`}
            </strong>
          </article>
          <article>
            <span>{t("Recent form")}</span>
            <strong>
              {desk.trust.recentHitRate == null
                ? "—"
                : `%${desk.trust.recentHitRate.toFixed(0)}`}
            </strong>
            <em>{t(desk.trust.recentStreakLabel)}</em>
          </article>
          <article>
            <span>{t("Vs home baseline")}</span>
            <strong>
              {desk.trust.baselineBeat == null
                ? "—"
                : desk.trust.baselineBeat
                  ? t("Ahead")
                  : t("Behind")}
            </strong>
          </article>
        </div>
      </div>

      <div className={styles.topGrid}>
        {desk.topPicks.length ? (
          desk.topPicks.map((pick, index) => (
            <article className={styles.topCard} key={pick.matchId}>
              <div className={styles.topRank}>#{index + 1}</div>
              <div className={styles.topMatch}>
                <strong>
                  {pick.homeTeam} vs {pick.awayTeam}
                </strong>
                <span>
                  {pick.leagueName} ·{" "}
                  {new Intl.DateTimeFormat(lang, {
                    timeZone: "Europe/Istanbul",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(pick.kickoffIso))}
                </span>
              </div>
              <div className={styles.topPick}>
                <span>{pick.market}</span>
                <strong>{pick.selection}</strong>
              </div>
              <div className={styles.topMeta}>
                <em>
                  {t("Confidence")} %{pick.confidence.toFixed(0)}
                </em>
                <em data-no-translate>
                  {pick.fairOdds != null ? pick.fairOdds.toFixed(2) : "—"} ·{" "}
                  {pick.oddsBand}
                </em>
              </div>
              {pick.lineMove ? (
                <div className={styles.lineRow}>
                  <MarketLineMoveBlock move={pick.lineMove} />
                  {pick.marketJoined ? (
                    <span className={styles.joined}>{t("Market joined")}</span>
                  ) : null}
                </div>
              ) : null}
              <p className={styles.reason}>{pick.reason}</p>
              <Link href={pick.href}>{t("Open analysis")} →</Link>
            </article>
          ))
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
