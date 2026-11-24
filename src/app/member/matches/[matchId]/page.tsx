import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { MemberMarketFamilyTabs } from "@/components/member-market-family-tabs";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { translateUiText } from "@/i18n/dictionaries";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { requireMember } from "@/lib/auth-session";
import { classifyMarketFamily } from "@/lib/member-market-family";
import { buildMatchContextSummary } from "@/lib/match-context-summary";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import { MEMBERSHIP_PLAN_LABELS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel } from "@/lib/prediction-dashboard-shared";
import { prisma } from "@/lib/prisma";
import { labelGoalLineMarket } from "@/modules/match-context-engine";
import styles from "./member-match.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "Europe/Istanbul";

function TeamLogo({
  src,
  name,
  size = 40,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const className = size <= 28 ? styles.logoSm : size >= 44 ? styles.logoLg : styles.logo;
  if (src) {
    return <Image className={className} src={src} alt="" width={size} height={size} />;
  }
  return (
    <span className={`${className} ${styles.logoFall}`} style={{ width: size, height: size }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
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
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.2 12.2l1.8 1.8 3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 21V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 4h10l-2.2 3.5L16 11H6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
function IconBall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M7.2 7.2l2.2 2.2M14.6 14.6l2.2 2.2M16.8 7.2l-2.2 2.2M9.4 14.6l-2.2 2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconBallSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
  const showOdds = true;

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
  const pickTitle = primary
    ? `${tr(primary.market)} · ${tr(primary.selection)}`
    : getPredictionLabel(prediction);
  const pickSubtitle = prediction.homeTeam;
  const pickProbability = primary?.probability ?? prediction.predictedProbability;
  const confScore = Math.max(
    0,
    Math.min(
      100,
      primary?.pickScore ?? primary?.probability ?? prediction.confidenceScore ?? pickProbability,
    ),
  );

  const league = await prisma.league.findFirst({
    where: { name: prediction.leagueName },
    select: { logoUrl: true },
  });

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
            reasons: [] as string[],
          })),
        )
        .sort((a, b) => b.pickScore - a.pickScore)
  ).slice(0, 3);

  const familyPicks = groups.flatMap((group) =>
    group.options.slice(0, 4).map((option, index) => ({
      key: `${group.number}-${option.selection}-${index}`,
      family: classifyMarketFamily(group.title, option.selection),
      market: group.title,
      selection: option.selection,
      probability: option.score,
      fairOdds: option.fairOdds ?? null,
    })),
  );

  const pickReasons = (primary?.reasons ?? [])
    .filter((line): line is string => typeof line === "string" && line.trim().length > 6)
    .slice(0, 3);

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

  const matchContext = await buildMatchContextSummary(matchId).catch(() => null);

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
            homeTeam: { select: { name: true, logoUrl: true } },
            awayTeam: { select: { name: true, logoUrl: true } },
          },
        })
      : [];

  const kickoffLabel = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(prediction.kickoffAt));

  const h2hDateFmt = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <main className={`${member.shell} member-plan-${user.plan.toLowerCase()}`}>
      <MemberPortalHeader plan={user.plan} active="home" memberName={user.name} />
      <div className={`${member.page} ${styles.page}`}>
        <header className={styles.matchHead}>
          <div className={styles.headTop}>
            <p className={styles.brandMark} data-no-translate>
              WINIQ · MAÇ
            </p>
            <div className={styles.headAside}>
              <span className={styles.planPill}>{MEMBERSHIP_PLAN_LABELS[user.plan]}</span>
              <Link className={styles.back} href="/member">
                ← {tr("All predictions")}
              </Link>
            </div>
          </div>

          <div className={styles.matchup}>
            <div className={`${styles.team} ${styles.teamHome}`}>
              <TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam} size={48} />
              <strong>{prediction.homeTeam}</strong>
            </div>
            <span className={styles.vsLine} aria-hidden />
            <span className={styles.vs}>vs</span>
            <span className={styles.vsLine} aria-hidden />
            <div className={`${styles.team} ${styles.teamAway}`}>
              <strong>{prediction.awayTeam}</strong>
              <TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam} size={48} />
            </div>
          </div>

          <div className={styles.metaRow}>
            <div className={styles.leagueRow}>
              {league?.logoUrl ? (
                <Image
                  className={styles.leagueLogo}
                  src={league.logoUrl}
                  alt=""
                  width={20}
                  height={20}
                />
              ) : null}
              <span>
                {prediction.leagueName}
                {ACTIVE_SEASON_YEAR ? ` · ${ACTIVE_SEASON_YEAR}` : ""}
              </span>
            </div>
            <span className={styles.metaSep} aria-hidden>
              |
            </span>
            <div className={styles.kick}>
              <IconCal />
              <span>{kickoffLabel}</span>
            </div>
          </div>
          {matchContext ? (
            <div className={styles.metaRow} style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <span className={styles.planPill}>
                {matchContext.predictionMode === "lineup_known_prediction"
                  ? tr("Lineup-known mode")
                  : tr("Early prediction mode")}
              </span>
              {matchContext.venue.isNeutral ? (
                <span className={styles.planPill}>{tr("Neutral venue")}</span>
              ) : null}
              {matchContext.venue.hostCountry ? (
                <span className={styles.planPill}>
                  {tr("Host")}: {matchContext.venue.hostCountry}
                </span>
              ) : null}
              {matchContext.homeElo != null && matchContext.awayElo != null ? (
                <span className={styles.planPill}>
                  Elo {Math.round(matchContext.homeElo)}–{Math.round(matchContext.awayElo)}
                  {" · "}
                  {Math.abs(matchContext.homeElo - matchContext.awayElo) < 40
                    ? tr("Even matchup")
                    : matchContext.homeElo > matchContext.awayElo
                      ? tr("Home favourite")
                      : tr("Away favourite")}
                </span>
              ) : null}
              {matchContext.goalLines?.find((line) => line.line === 2.5) ? (
                <span className={styles.planPill}>
                  {tr("Goals 2.5")} ·{" "}
                  {(
                    (matchContext.goalLines.find((line) => line.line === 2.5)?.overProb ??
                      0) * 100
                  ).toFixed(0)}
                  % {tr("Over")}
                  {(matchContext.goalLines.find((line) => line.line === 2.5)?.overProb ??
                    0) < 0.48
                    ? ` → ${tr("Lean under 2.5")}`
                    : (matchContext.goalLines.find((line) => line.line === 2.5)
                          ?.overProb ?? 0) > 0.55
                      ? ` → ${tr("Lean over 2.5")}`
                      : ""}
                </span>
              ) : null}
              {matchContext.goalLines
                ?.filter((line) => line.highlighted)
                .map((line) => (
                  <span className={styles.planPill} key={line.line}>
                    {labelGoalLineMarket(line.line, "over")}{" "}
                    {(line.overProb * 100).toFixed(0)}%
                  </span>
                ))}
              {matchContext.monteCarloCheck ? (
                <span className={styles.planPill}>
                  MC{" "}
                  {matchContext.monteCarloCheck.withinTolerance
                    ? tr("aligned")
                    : tr("check")}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        <section className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <div className={styles.metricHead}>
              <IconTarget />
              {tr("Main prediction")}
            </div>
            <div className={styles.pickBox}>
              <h1 className={styles.pickTitle}>{pickTitle}</h1>
              <p className={styles.pickSub}>{pickSubtitle}</p>
              {pickReasons.length ? (
                <ul className={styles.reasonList}>
                  {pickReasons.map((line) => (
                    <li key={line}>{tr(line)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>

          <article className={styles.metricCard}>
            <div className={`${styles.metricHead} ${styles.metricHeadGreen}`}>
              <IconShield />
              {tr("Confidence")}
            </div>
            {showOdds ? (
              <>
                <div className={styles.confBadge}>%{confScore.toFixed(0)}</div>
                <p className={styles.metricFoot}>{tr("Model confidence for this pick")}</p>
              </>
            ) : (
              <p className={styles.lockHint}>{tr("Upgrade plan to see probabilities and confidence.")}</p>
            )}
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricHead}>
              <IconBars />
              {tr("Match probabilities")}
            </div>
            {showOdds ? (
              <>
                <div className={styles.probSplit}>
                  <div className={`${styles.probCell} ${styles.probHome}`}>
                    <span>{tr("Home short")}</span>
                    <strong>%{prediction.homeProbability.toFixed(0)}</strong>
                  </div>
                  <div className={styles.probCell}>
                    <span>{tr("Draw")}</span>
                    <strong>%{prediction.drawProbability.toFixed(0)}</strong>
                  </div>
                  <div className={styles.probCell}>
                    <span>{tr("Away")}</span>
                    <strong>%{prediction.awayProbability.toFixed(0)}</strong>
                  </div>
                </div>
                <p className={styles.metricFoot}>{tr("Probability summary")}</p>
              </>
            ) : (
              <p className={styles.lockHint}>{tr("Upgrade plan to see match probabilities.")}</p>
            )}
          </article>
        </section>

        {formTip ? (
          <aside className={styles.formStrip} aria-label={tr("Recent form")}>
            <span className={styles.formIcon}>
              <IconFlag />
            </span>
            <p className={styles.formText}>{formTip}</p>
          </aside>
        ) : null}

        <article className={styles.h2hCard}>
          <div className={styles.h2hHead}>
            <span className={styles.h2hIcon}>
              <IconBall />
            </span>
            <div>
              <h2 className={styles.h2hTitle}>{tr("Recent meetings (H2H)")}</h2>
              <span className={styles.h2hUnderline} aria-hidden />
            </div>
          </div>
          {h2h.length ? (
            <ul className={styles.h2hList}>
              {h2h.map((match, index) => (
                <li className={styles.h2hRow} key={`${match.kickoffAt.toISOString()}-${index}`}>
                  <div className={styles.h2hDate}>
                    <IconCal />
                    <span>{h2hDateFmt.format(match.kickoffAt)}</span>
                  </div>
                  <div className={styles.h2hFixture}>
                    <div className={styles.h2hTeamHome}>
                      <TeamLogo src={match.homeTeam.logoUrl} name={match.homeTeam.name} size={28} />
                      <strong>{match.homeTeam.name}</strong>
                    </div>
                    <span className={styles.score}>
                      {match.homeScore}–{match.awayScore}
                    </span>
                    <div className={styles.h2hTeamAway}>
                      <strong>{match.awayTeam.name}</strong>
                      <TeamLogo src={match.awayTeam.logoUrl} name={match.awayTeam.name} size={28} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyPad}>{tr("No head-to-head results yet.")}</p>
          )}
        </article>

        <article className={styles.recCard}>
          <div className={styles.recHead}>
            <span className={styles.recHeadIcon}>
              <IconBall />
            </span>
            <span className={styles.recHeadDivider} aria-hidden />
            <div>
              <span className={styles.recBadge}>{tr("RECOMMENDED PICKS")}</span>
              <h2 className={styles.recTitle}>{tr("Top 3 for this match")}</h2>
              <p className={styles.recSub}>
                {tr("Full catalog is below; start with the clear picks.")}
              </p>
            </div>
          </div>
          <ol className={styles.recList}>
            {topPicks.map((pick, index) => {
              const odds =
                "fairOdds" in pick && typeof pick.fairOdds === "number" && pick.fairOdds > 0
                  ? pick.fairOdds
                  : null;
              const market =
                "market" in pick && typeof pick.market === "string" ? pick.market : "";
              const selection =
                "selection" in pick && typeof pick.selection === "string" ? pick.selection : "";
              const pctRaw =
                "probability" in pick && typeof pick.probability === "number"
                  ? pick.probability
                  : "pickScore" in pick && typeof pick.pickScore === "number"
                    ? pick.pickScore
                    : prediction.confidenceScore;
              const pct = Math.max(0, Math.min(100, pctRaw));
              return (
                <li className={styles.recItem} key={`${market}-${selection}-${index}`}>
                  <span className={styles.recRank}>#{index + 1}</span>
                  <div className={styles.recPick}>
                    <span className={styles.recMarket}>
                      <IconBallSm />
                      {tr(market)}
                    </span>
                    <strong>{tr(selection)}</strong>
                  </div>
                  {showOdds ? (
                    <>
                      <div className={styles.recConf}>
                        <span>
                          {tr("Confidence")} <b>%{pct.toFixed(0)}</b>
                        </span>
                        <span className={styles.recConfBar} aria-hidden>
                          <i style={{ width: `${Math.max(4, pct)}%` }} />
                        </span>
                      </div>
                      {odds != null ? (
                        <span className={styles.recOdds}>
                          {tr("odds")} <b>{odds.toFixed(2)}</b>
                        </span>
                      ) : (
                        <span className={styles.recOddsMuted}>—</span>
                      )}
                    </>
                  ) : (
                    <p className={styles.lockHint}>{tr("Upgrade plan to see probabilities and confidence.")}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </article>

        {familyPicks.length ? <MemberMarketFamilyTabs picks={familyPicks} /> : null}

        <details className={styles.catalogWrap}>
          <summary className={styles.catalogToggle}>{tr("Show all markets")}</summary>
          <BetMarketCatalogPanel
            groups={groups}
            locale="tr"
            accessPlan={user.plan}
            showBestOpportunities={false}
          />
        </details>

        <section className={styles.notice}>
          {tr("WINIQ provides analysis only. There is no guarantee of profit.")}
        </section>
      </div>
    </main>
  );
}
