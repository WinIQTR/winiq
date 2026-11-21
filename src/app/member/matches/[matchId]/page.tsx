import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { translateUiText } from "@/i18n/dictionaries";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { BET_MARKET_COUNT, buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { requireMember } from "@/lib/auth-session";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import {
  getPredictionLabel,
  getUiConfidence,
} from "@/lib/prediction-dashboard-shared";
import { prisma } from "@/lib/prisma";
import styles from "./member-match.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "Europe/Istanbul";

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <Image className={styles.logo} src={src} alt="" width={40} height={40} />;
  }
  return <span className={styles.logoFall}>{name.slice(0, 2).toUpperCase()}</span>;
}

function IconTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconBars() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V10M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 16l5-5 4 4 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7h11M15 3l4 4-4 4M17 17H6M9 13l-4 4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.4l.9-5L4.8 8.9l5-.7L12 3.6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10v6M12 7.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconCal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default async function MemberMatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const user = await requireMember();
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId)) notFound();

  const predictions = await loadDashboardPredictionSnapshot(5_000);
  const prediction = predictions.find((item) => item.matchId === matchId);
  if (!prediction) notFound();

  const tr = (source: string) => translateUiText(source, "tr");
  const showOdds = user.plan !== "BASIC";

  const groups = buildBetMarketCatalog({
    matchId: prediction.matchId,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    homeProbability: prediction.homeProbability,
    drawProbability: prediction.drawProbability,
    awayProbability: prediction.awayProbability,
    expectedHomeGoals: prediction.expectedHomeGoals,
    expectedAwayGoals: prediction.expectedAwayGoals,
    confidenceScore: prediction.confidenceScore,
    knownMarkets: prediction.popularMarketsSummary,
    locale: "tr",
  });

  const primary = prediction.topPicks[0] ?? null;
  const pickLabel = primary
    ? `${tr(primary.market)} · ${tr(primary.selection)}`
    : getPredictionLabel(prediction);
  const pickProbability = primary?.probability ?? prediction.predictedProbability;
  const pickConfidence = getUiConfidence(primary?.pickScore ?? prediction.confidenceScore);
  const whyText =
    primary?.reasons
      ?.slice(0, 2)
      .map((reason) => tr(reason))
      .join(" ") || tr("Model output based on recent form and historical calibration.");

  const topPicks = (prediction.topPicks.length
    ? prediction.topPicks
    : [...groups]
        .flatMap((group) =>
          group.options.slice(0, 1).map((option) => ({
            market: group.title,
            selection: option.selection,
            probability: option.score,
            fairOdds: option.fairOdds,
            pickScore: option.score,
          })),
        )
        .sort((a, b) => b.pickScore - a.pickScore)
  ).slice(0, 3);

  const formTip = buildMatchFormTip(
    {
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      homeRecentResults: prediction.homeRecentResults,
      awayRecentResults: prediction.awayRecentResults,
      homeVenueResults: prediction.homeVenueResults,
      awayVenueResults: prediction.awayVenueResults,
    },
    tr,
  );

  const h2h =
    prediction.homeTeamId && prediction.awayTeamId
      ? await prisma.match.findMany({
          where: {
            status: "FINISHED",
            homeScore: { not: null },
            OR: [
              { homeTeamId: prediction.homeTeamId, awayTeamId: prediction.awayTeamId },
              { homeTeamId: prediction.awayTeamId, awayTeamId: prediction.homeTeamId },
            ],
          },
          orderBy: { kickoffAt: "desc" },
          take: 5,
          select: {
            kickoffAt: true,
            homeScore: true,
            awayScore: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        })
      : [];

  const kickoffLabel = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(prediction.kickoffAt));

  return (
    <main className={`${member.shell} member-plan-${user.plan.toLowerCase()}`}>
      <MemberPortalHeader plan={user.plan} active="predictions" memberName={user.name} />
      <div className={`${member.page} ${styles.page}`}>
        <div className={styles.topBar}>
          <p data-no-translate>WINIQ · MAÇ DETAYI</p>
          <span className={styles.planBadge}>
            {MEMBERSHIP_PLAN_LABELS[user.plan]} {MEMBERSHIP_PLAN_MARKET_LIMITS[user.plan]}/
            {BET_MARKET_COUNT} pazar
          </span>
        </div>

        <header className={styles.matchHead}>
          <Link className={styles.back} href="/member">
            ← {tr("Back to predictions")}
          </Link>
          <div>
            <div className={styles.leagueRow}>
              <span>{prediction.leagueName}</span>
              <span>·</span>
              <span>{ACTIVE_SEASON_YEAR}</span>
            </div>
            <div className={styles.matchup}>
              <div className={styles.team}>
                <TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam} />
                <strong>{prediction.homeTeam}</strong>
              </div>
              <span className={styles.vs}>VS</span>
              <div className={styles.team}>
                <TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam} />
                <strong>{prediction.awayTeam}</strong>
              </div>
            </div>
          </div>
          <div className={styles.kick}>
            <IconCal />
            <span>{kickoffLabel}</span>
          </div>
        </header>

        <section className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <IconTarget />
              {tr("Main prediction")}
            </div>
            <div className={styles.cardBody}>
              <h1 className={styles.pickTitle}>{pickLabel}</h1>
              {showOdds ? (
                <div className={styles.metricRow}>
                  <div className={styles.metric}>
                    <span>{tr("Probability")}</span>
                    <strong>%{pickProbability.toFixed(0)}</strong>
                  </div>
                  <div className={styles.metric}>
                    <span>{tr("Confidence")}</span>
                    <strong>{tr(pickConfidence)}</strong>
                  </div>
                </div>
              ) : (
                <p className={styles.lockHint}>{tr("Upgrade plan to see probabilities and confidence.")}</p>
              )}
              <div className={styles.why}>
                <div className={styles.whyHead}>
                  <IconInfo />
                  {tr("Why this pick?")}
                </div>
                <p>{whyText}</p>
              </div>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <IconBars />
              {tr("Match probabilities")}
            </div>
            <div className={styles.cardBody}>
              {showOdds ? (
                <div className={styles.probList}>
                  {[
                    { label: prediction.homeTeam, value: prediction.homeProbability },
                    { label: tr("Draw"), value: prediction.drawProbability },
                    { label: prediction.awayTeam, value: prediction.awayProbability },
                  ].map((row) => (
                    <div className={styles.probRow} key={row.label}>
                      <div className={styles.probMeta}>
                        <span>{row.label}</span>
                        <b>%{row.value.toFixed(0)}</b>
                      </div>
                      <span className={styles.bar} aria-hidden>
                        <i style={{ width: `${Math.max(2, Math.min(100, row.value))}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.lockHint}>{tr("Upgrade plan to see match probabilities.")}</p>
              )}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <IconTrend />
              {tr("Recent form")}
            </div>
            <div className={styles.cardBody}>
              {formTip ? (
                <div className={styles.formBox}>
                  <IconCal />
                  <span>{formTip}</span>
                </div>
              ) : (
                <p className={styles.empty}>{tr("No recent form summary yet.")}</p>
              )}
            </div>
          </article>
        </section>

        <section className={styles.gridLower}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <IconSwap />
              {tr("Head-to-head (H2H)")}
            </div>
            <div className={styles.cardBody}>
              {h2h.length ? (
                <table className={styles.h2hTable}>
                  <thead>
                    <tr>
                      <th>{tr("Date")}</th>
                      <th>{tr("Fixture")}</th>
                      <th>{tr("Score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.map((match, index) => (
                      <tr key={`${match.kickoffAt.toISOString()}-${index}`}>
                        <td>
                          {new Intl.DateTimeFormat("tr-TR", {
                            timeZone: TZ,
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).format(match.kickoffAt)}
                        </td>
                        <td>
                          {match.homeTeam.name} – {match.awayTeam.name}
                        </td>
                        <td>
                          <span className={styles.score}>
                            {match.homeScore} - {match.awayScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.empty}>{tr("No head-to-head results yet.")}</p>
              )}
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <IconStar />
              {tr("Top 3 predictions")}
            </div>
            <div className={styles.cardBody}>
              <ol className={styles.topList}>
                {topPicks.map((pick, index) => {
                  const conf = getUiConfidence(
                    "pickScore" in pick && typeof pick.pickScore === "number"
                      ? pick.pickScore
                      : "probability" in pick && typeof pick.probability === "number"
                        ? pick.probability
                        : prediction.confidenceScore,
                  );
                  const odds =
                    "fairOdds" in pick && typeof pick.fairOdds === "number" && pick.fairOdds > 0
                      ? pick.fairOdds
                      : null;
                  const market =
                    "market" in pick && typeof pick.market === "string" ? pick.market : "";
                  const selection =
                    "selection" in pick && typeof pick.selection === "string"
                      ? pick.selection
                      : "";
                  const pct =
                    "probability" in pick && typeof pick.probability === "number"
                      ? pick.probability
                      : "pickScore" in pick && typeof pick.pickScore === "number"
                        ? pick.pickScore
                        : null;
                  return (
                    <li className={styles.topItem} key={`${market}-${selection}-${index}`}>
                      <span className={styles.num}>{index + 1}</span>
                      <div>
                        <small>{tr(market)}</small>
                        <strong>{tr(selection)}</strong>
                      </div>
                      <div className={styles.topMeta}>
                        <span className={styles.conf}>
                          {tr(conf)}
                          {pct != null ? ` (%${pct.toFixed(0)})` : ""}
                        </span>
                        {showOdds && odds != null ? (
                          <span className={styles.odds}>{odds.toFixed(2)}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </article>
        </section>

        <div className={styles.catalogWrap}>
          <BetMarketCatalogPanel groups={groups} locale="tr" accessPlan={user.plan} />
        </div>

        <section className={styles.notice}>
          {tr("WINIQ provides analysis only. There is no guarantee of profit.")}
        </section>
      </div>
    </main>
  );
}
