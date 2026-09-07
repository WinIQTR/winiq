import { PageShell } from "@/components/page-shell";
import {
  ACTIVE_SEASON_LABEL,
  ACTIVE_SEASON_YEAR,
  isDateInSeason,
} from "@/config/season";
import {
  buildValueBetAccuracyReport,
  type ValueBetAccuracyGroup,
  type ValueBetAccuracyReport,
} from "@/lib/value-bet-accuracy";
import { loadValueBetDashboardSnapshot } from "@/lib/value-bet-dashboard-snapshot";
import { buildValueBetExplanation, type ValueBetVerdict } from "@/lib/value-bet-explanation";
import { buildValueBetPortfolio, type PortfolioSelection } from "@/lib/value-bet-portfolio";
import {
  buildValueBetLearningReport,
  type ValueBetLearningReport,
} from "@/lib/value-bet-learning";
import {
  buildValueBetLeagueProfileReport,
  type LeagueProfileStatus,
  type ValueBetLeagueProfileReport,
} from "@/lib/value-bet-league-profile";
import {
  buildChampionChallengerAudit,
  type ChampionChallengerAudit,
} from "@/lib/value-bet-champion-challenger";
import {
  buildModelHealthReport,
  type HealthLevel,
  type ModelHealthReport,
} from "@/lib/value-bet-model-health";

import styles from "./value-bets-page.module.css";

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";

function formatPercentage(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMetricPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatOdds(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: ISTANBUL_TIME_ZONE,
  }).format(value);
}

function formatBookmakerCount(value: number): string {
  return `${value} bookmaker prices`;
}

const VERDICT_LABELS: Record<ValueBetVerdict, string> = {
  ELITE_VALUE: "Elite Value",
  VERY_STRONG_VALUE: "Very Strong Value",
  STRONG_VALUE: "Strong Value",
  QUALIFIED_VALUE: "Qualified Value",
};

const SIGNAL_LABELS: Record<string, string> = {
  DOUBLE_DIGIT_PROBABILITY_GAP: "Double-digit probability gap",
  HIGH_EXPECTED_VALUE: "High expected value",
  BROAD_MARKET_COVERAGE: "Broad market coverage",
  STRONG_ODDS_PREMIUM: "Strong odds premium",
};

function AiMatchExplanations({ selections }: { selections: PortfolioSelection[] }) {
  return (
    <div className={styles.explanationBlock}>
      <div className={styles.explanationHeading}>
        <h3>AI Match Explanations</h3>
        <p>Every explanation is generated from the published model and bookmaker numbers.</p>
      </div>
      <div className={styles.explanationList}>
        {selections.map(({ row, portfolioStakePercentage }) => {
          const explanation = buildValueBetExplanation(row);
          return (
            <details className={styles.explanation} key={`explanation-${row.matchId}-${row.marketKey}`}>
              <summary>
                <span><strong>{row.homeTeam} – {row.awayTeam}</strong><small>{row.market} • {row.selection}</small></span>
                <span className={styles.verdict}>{VERDICT_LABELS[explanation.verdict]}</span>
              </summary>
              <div className={styles.explanationGrid}>
                <div><span>Model / Market</span><strong>{row.modelProbability.toFixed(1)}% / {row.marketProbability.toFixed(1)}%</strong></div>
                <div><span>Probability Gap</span><strong className={styles.positive}>{formatPercentage(explanation.probabilityGap)}</strong></div>
                <div><span>Fair / Best Odds</span><strong>{formatOdds(row.fairOdds)} / {formatOdds(row.bestOdds)}</strong></div>
                <div><span>Odds Premium</span><strong className={styles.positive}>{explanation.oddsPremium === null ? "—" : formatPercentage(explanation.oddsPremium)}</strong></div>
                <div><span>Expected Profit per Unit</span><strong className={styles.positive}>+{explanation.expectedProfitPerUnit.toFixed(3)}</strong></div>
                <div><span>Market Coverage</span><strong>{formatBookmakerCount(explanation.bookmakerCoverage)}</strong></div>
                <div><span>Portfolio Decision</span><strong>{portfolioStakePercentage.toFixed(2)}%</strong><small>Daily limit: 6%</small></div>
              </div>
              <div className={styles.signalRow}>
                {explanation.confidenceSignals.length > 0
                  ? explanation.confidenceSignals.map((signal) => <span key={signal}>{SIGNAL_LABELS[signal]}</span>)
                  : <span>Standard qualifying signals</span>}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function AccuracyBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: ValueBetAccuracyGroup[];
}) {
  return (
    <div className={styles.accuracyBreakdown}>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className={styles.muted}>No settled data yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.accuracyTable}`}>
            <thead><tr><th>GROUP</th><th>SETTLED</th><th>W / L</th><th>WIN RATE</th><th>MODEL</th><th>GAP</th><th>PROFIT</th><th>ROI</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <td><strong>{row.label}</strong>{row.voided > 0 && <span className={styles.meta}>{`${row.voided} void`}</span>}</td>
                <td>{row.settled}</td><td>{row.won} / {row.lost}</td>
                <td>{formatMetricPercentage(row.winRate)}</td>
                <td>{formatMetricPercentage(row.averageModelProbability)}</td>
                <td className={(row.calibrationGap ?? 0) >= 0 ? styles.positive : styles.negative}>{row.calibrationGap === null ? "—" : formatPercentage(row.calibrationGap)}</td>
                <td className={row.profitUnits >= 0 ? styles.positive : styles.negative}>{row.profitUnits > 0 ? "+" : ""}{row.profitUnits.toFixed(2)}</td>
                <td className={(row.roi ?? 0) >= 0 ? styles.positive : styles.negative}>{row.roi === null ? "—" : formatPercentage(row.roi)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ValueBetAccuracyDashboard({ report }: { report: ValueBetAccuracyReport }) {
  const statusLabel = report.sampleStatus === "BUILDING"
    ? "DATA BUILDING"
    : report.sampleStatus === "EARLY"
      ? "EARLY SAMPLE"
      : "MATURE SAMPLE";

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>Value Bet Accuracy Dashboard</h2><p>Only immutable pre-kickoff selections with final results are included.</p></div>
        <span className={`${styles.sampleBadge} ${report.sampleStatus === "MATURE" ? styles.sampleMature : ""}`}>{statusLabel}</span>
      </div>

      <div className={styles.accuracyMetrics}>
        <article><span>SETTLED BETS</span><strong>{report.settled}</strong><small>{`${report.won} won • ${report.lost} lost • ${report.voided} void`}</small></article>
        <article><span>WIN RATE</span><strong>{formatMetricPercentage(report.winRate)}</strong><small>Decided bets only</small></article>
        <article><span>PROFIT UNITS</span><strong className={report.profitUnits >= 0 ? styles.positive : styles.negative}>{report.profitUnits > 0 ? "+" : ""}{report.profitUnits.toFixed(2)}</strong><small>Flat 1-unit stake</small></article>
        <article><span>FLAT-STAKE ROI</span><strong className={(report.roi ?? 0) >= 0 ? styles.positive : styles.negative}>{report.roi === null ? "—" : formatPercentage(report.roi)}</strong><small>Profit divided by settled bets</small></article>
      </div>

      {report.sampleStatus !== "MATURE" && (
        <div className={styles.sampleNotice}>
          <strong>Sample is still developing.</strong>
          <span>Performance is descriptive, not a reason to change the active model. At least 100 settled bets are required for a mature sample.</span>
        </div>
      )}

      <div className={styles.accuracySections}>
        <AccuracyBreakdown title="Performance by Probability Range" rows={report.probabilityBuckets} />
        <AccuracyBreakdown title="Performance by Market" rows={report.markets} />
        <AccuracyBreakdown title="Performance by League" rows={report.leagues} />
      </div>
    </section>
  );
}

function HistoricalLearningPanel({ report }: { report: ValueBetLearningReport }) {
  const statusLabel = {
    COLLECTING: "LEARNING DATA COLLECTING",
    BASELINE_ONLY: "NO BETTER CANDIDATE",
    CANDIDATE_READY: "CANDIDATE AWAITS APPROVAL",
    CANDIDATE_REJECTED: "CANDIDATE REJECTED",
  }[report.status];

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>Historical Learning and Weight Optimizer</h2><p>Chronological learning produces advisory candidates only. Production settings remain locked.</p></div>
        <span className={`${styles.learningBadge} ${report.status === "CANDIDATE_READY" ? styles.learningReady : ""}`}>{statusLabel}</span>
      </div>

      <div className={styles.learningProgress}>
        <div><strong>{report.independentSelections} / {report.minimumSample}</strong><span>independent settled match selections</span></div>
        <div className={styles.progressTrack}><span style={{ width: `${report.progressPercentage}%` }} /></div>
        <strong>{report.progressPercentage.toFixed(1)}%</strong>
      </div>

      <div className={styles.learningMetrics}>
        <article><span>LEARNING SAMPLE</span><strong>{report.trainSelections || "—"}</strong><small>First chronological 70%</small></article>
        <article><span>FORWARD VALIDATION</span><strong>{report.validationSelections || "—"}</strong><small>Latest chronological 30%</small></article>
        <article><span>BASELINE ROI</span><strong>{report.baseline.roi === null ? "—" : formatPercentage(report.baseline.roi)}</strong><small>Current production baseline</small></article>
        <article><span>CANDIDATE ROI</span><strong>{report.candidate?.roi === null || !report.candidate ? "—" : formatPercentage(report.candidate.roi)}</strong><small>Never activated automatically</small></article>
      </div>

      {report.status === "COLLECTING" ? (
        <div className={styles.learningNotice}><strong>Learning is not ready.</strong><span>The optimizer will remain inactive until at least 300 independent match results are available.</span></div>
      ) : (
        <>
          {report.gates && (
            <div className={styles.gateGrid}>
              <span className={report.gates.roiImproved ? styles.gatePass : styles.gateFail}>ROI improvement: {report.gates.roiImproved ? "PASS" : "FAIL"}</span>
              <span className={report.gates.brierNotWorse ? styles.gatePass : styles.gateFail}>Brier not worse: {report.gates.brierNotWorse ? "PASS" : "FAIL"}</span>
              <span className={report.gates.drawdownNotWorse ? styles.gatePass : styles.gateFail}>Drawdown not worse: {report.gates.drawdownNotWorse ? "PASS" : "FAIL"}</span>
            </div>
          )}
          {report.recommendations.length > 0 && (
            <div className={styles.tableWrap}><table className={`${styles.table} ${styles.learningTable}`}>
              <thead><tr><th>MARKET</th><th>LEARNING SAMPLE</th><th>TRAIN ROI</th><th>CALIBRATION GAP</th><th>PROPOSED WEIGHT</th><th>DECISION</th></tr></thead>
              <tbody>{report.recommendations.map((row) => (
                <tr key={row.marketKey}><td><strong>{row.market}</strong></td><td>{row.trainSelections}</td><td>{formatPercentage(row.trainRoi)}</td><td>{formatPercentage(row.calibrationGap)}</td><td>{row.proposedMultiplier.toFixed(2)}×</td><td>{row.reason}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}

      <div className={styles.productionLock}><strong>PRODUCTION LOCKED</strong><span>20% ML / 80% Poisson and Selection Policy V2 remain unchanged. Explicit approval is required for any future activation.</span></div>
    </section>
  );
}

const LEAGUE_STATUS_LABELS: Record<LeagueProfileStatus, string> = {
  COLLECTING: "DATA COLLECTING",
  PRELIMINARY: "PRELIMINARY PROFILE",
  RELIABLE: "RELIABLE SAMPLE",
  BROAD_SAMPLE: "BROAD SAMPLE",
  MAXIMUM_SAMPLE: "MAXIMUM SAMPLE",
};

function LeagueProfilePanel({ report }: { report: ValueBetLeagueProfileReport }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>League Profile Engine</h2><p>Independent pre-kickoff Value Bets are evaluated separately for every league.</p></div>
        <span className={styles.learningBadge}>ADVISORY ONLY</span>
      </div>

      <div className={styles.leagueSummary}>
        <article><span>INDEPENDENT RESULTS</span><strong>{report.independentSelections}</strong><small>Same-match duplicates removed</small></article>
        <article><span>LEAGUES OBSERVED</span><strong>{report.leagues.length}</strong><small>With at least one result</small></article>
        <article><span>CALIBRATION READY</span><strong>{report.calibrationReadyLeagues}</strong><small>At least 40 results per league</small></article>
        <article><span>RELIABLE LEAGUES</span><strong>{report.reliableLeagues}</strong><small>At least 100 results per league</small></article>
      </div>

      {report.leagues.length === 0 ? (
        <div className={styles.emptyState}><h2>No league profile data yet</h2><p>Profiles will appear after Value Bets receive final results.</p></div>
      ) : (
        <div className={styles.leagueCards}>
          {report.leagues.map((league) => (
            <article className={styles.leagueCard} key={league.leagueApiId}>
              <header><div><strong>{league.leagueName}</strong><small>{league.independentSelections} independent results</small></div><span>{LEAGUE_STATUS_LABELS[league.status]}</span></header>
              <div className={styles.leagueMetricGrid}>
                <div><span>WIN RATE</span><strong>{league.winRate.toFixed(1)}%</strong></div>
                <div><span>ROI</span><strong className={league.roi >= 0 ? styles.positive : styles.negative}>{formatPercentage(league.roi)}</strong></div>
                <div><span>CALIBRATION GAP</span><strong className={Math.abs(league.calibrationGap) <= 5 ? styles.positive : styles.negative}>{formatPercentage(league.calibrationGap)}</strong></div>
                <div><span>BRIER SCORE</span><strong>{league.brierScore.toFixed(4)}</strong></div>
                <div><span>RELIABILITY SCORE</span><strong>{league.reliabilityScore.toFixed(1)} / 100</strong></div>
              </div>
              <div className={styles.leagueGates}>
                <span className={league.calibrationReady ? styles.gatePass : styles.gatePending}>{league.calibrationReady ? "Calibration: READY" : `Calibration: ${league.independentSelections}/40`}</span>
                <span className={league.reliabilityReady ? styles.gatePass : styles.gatePending}>{league.reliabilityReady ? "Reliability: READY" : `Reliability: ${league.independentSelections}/100`}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className={styles.productionLock}><strong>NO AUTOMATIC LEAGUE WEIGHTING</strong><span>League profiles are descriptive. New-season unseen testing and explicit approval are required before any production use.</span></div>
    </section>
  );
}

function AuditMetric({ label, champion, challenger }: { label: string; champion: number | null; challenger: number | null }) {
  return (
    <div><span>{label}</span><strong>{champion === null ? "—" : champion.toFixed(4)}</strong><small>{challenger === null ? "Challenger —" : `Challenger ${challenger.toFixed(4)}`}</small></div>
  );
}

function ChampionChallengerPanel({ audit }: { audit: ChampionChallengerAudit }) {
  const statusLabel = {
    COLLECTING: "AUDIT DATA COLLECTING",
    NO_DISTINCT_CHALLENGER: "NO DISTINCT CHALLENGER",
    CHALLENGER_REJECTED: "CHALLENGER REJECTED",
    CHALLENGER_PASSED: "CHALLENGER PASSED AUDIT",
  }[audit.status];

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>Champion–Challenger Ensemble Audit</h2><p>The locked 20% ML / 80% Poisson Champion is compared with a calibrated Challenger on a final unseen period.</p></div>
        <span className={`${styles.auditBadge} ${audit.status === "CHALLENGER_PASSED" ? styles.auditPassed : audit.status === "CHALLENGER_REJECTED" ? styles.auditRejected : ""}`}>{statusLabel}</span>
      </div>

      <div className={styles.learningProgress}>
        <div><strong>{audit.independentSelections} / {audit.minimumSample}</strong><span>independent settled match selections</span></div>
        <div className={styles.progressTrack}><span style={{ width: `${audit.progressPercentage}%` }} /></div>
        <strong>{audit.progressPercentage.toFixed(1)}%</strong>
      </div>

      <div className={styles.auditSplit}>
        <article><span>PROFILE</span><strong>{audit.profileSelections || "—"}</strong><small>Chronological first 60%</small></article>
        <article><span>SELECTION</span><strong>{audit.selectionSelections || "—"}</strong><small>Challenger chosen on next 20%</small></article>
        <article><span>FINAL UNSEEN TEST</span><strong>{audit.finalUnseenSelections || "—"}</strong><small>Never used for weight selection</small></article>
        <article><span>CHALLENGER WEIGHT</span><strong>{audit.selectedChallengerWeight === null ? "—" : `${(audit.selectedChallengerWeight * 100).toFixed(0)}%`}</strong><small>Selected before final test</small></article>
      </div>

      {audit.status === "COLLECTING" ? (
        <div className={styles.learningNotice}><strong>Final audit is not ready.</strong><span>At least 300 independent results are required before profile, selection and final unseen periods are opened.</span></div>
      ) : (
        <>
          <div className={styles.auditMetrics}>
            <AuditMetric label="BRIER • CHAMPION" champion={audit.champion.brierScore} challenger={audit.challenger?.brierScore ?? null} />
            <AuditMetric label="LOG LOSS • CHAMPION" champion={audit.champion.logLoss} challenger={audit.challenger?.logLoss ?? null} />
            <AuditMetric label="ECE • CHAMPION" champion={audit.champion.ece} challenger={audit.challenger?.ece ?? null} />
            <AuditMetric label="ACCURACY • CHAMPION" champion={audit.champion.accuracy} challenger={audit.challenger?.accuracy ?? null} />
          </div>
          {audit.gates && <div className={styles.auditGates}>
            <span className={audit.gates.distinctWeight ? styles.gatePass : styles.gateFail}>Distinct weight: {audit.gates.distinctWeight ? "PASS" : "FAIL"}</span>
            <span className={audit.gates.brierImproved ? styles.gatePass : styles.gateFail}>Brier lower: {audit.gates.brierImproved ? "PASS" : "FAIL"}</span>
            <span className={audit.gates.logLossImproved ? styles.gatePass : styles.gateFail}>Log Loss lower: {audit.gates.logLossImproved ? "PASS" : "FAIL"}</span>
            <span className={audit.gates.eceImproved ? styles.gatePass : styles.gateFail}>ECE lower: {audit.gates.eceImproved ? "PASS" : "FAIL"}</span>
            <span className={audit.gates.accuracyProtected ? styles.gatePass : styles.gateFail}>Accuracy protected: {audit.gates.accuracyProtected ? "PASS" : "FAIL"}</span>
          </div>}
        </>
      )}

      <div className={styles.productionLock}><strong>CHAMPION REMAINS ACTIVE</strong><span>Passing this audit is not production approval. New-season out-of-time validation and explicit approval remain mandatory.</span></div>
    </section>
  );
}

const HEALTH_LABELS: Record<HealthLevel, string> = { HEALTHY: "HEALTHY", WARNING: "WARNING", CRITICAL: "CRITICAL" };

function ModelHealthPanel({ report }: { report: ModelHealthReport }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>Model Health and Drift Monitor</h2><p>Data freshness, bookmaker source lag and recent model behaviour are monitored without changing production.</p></div>
        <span className={`${styles.healthBadge} ${report.overallLevel === "HEALTHY" ? styles.healthHealthy : report.overallLevel === "WARNING" ? styles.healthWarning : styles.healthCritical}`}>{HEALTH_LABELS[report.overallLevel]}</span>
      </div>

      <div className={styles.healthGrid}>
        <article><span>SNAPSHOT FRESHNESS</span><strong>{report.snapshot.ageHours === null ? "—" : `${report.snapshot.ageHours.toFixed(1)} h`}</strong><small>{HEALTH_LABELS[report.snapshot.level]} • Warning after 8 h</small></article>
        <article><span>BOOKMAKER SOURCE LAG</span><strong>{report.odds.averageSourceLagHours === null ? "—" : `${report.odds.averageSourceLagHours.toFixed(1)} h`}</strong><small>{report.odds.selections} selections • {report.odds.staleSelections} stale</small></article>
        <article><span>DRIFT SAMPLE</span><strong>{report.drift.independentSelections} / {report.drift.minimumRequired}</strong><small>100 baseline + 30 recent</small></article>
        <article><span>DRIFT STATUS</span><strong>{report.drift.status}</strong><small>No automatic production action</small></article>
      </div>

      {report.drift.status === "COLLECTING" ? (
        <div className={styles.learningNotice}><strong>Drift data is still collecting.</strong><span>At least 130 independent results are required before the latest 30 results can be compared with a 100+ result baseline.</span></div>
      ) : report.drift.baseline && report.drift.recent && report.drift.changes ? (
        <div className={styles.driftTableWrap}><table className={`${styles.table} ${styles.driftTable}`}>
          <thead><tr><th>METRIC</th><th>BASELINE</th><th>RECENT 30</th><th>CHANGE</th></tr></thead>
          <tbody>
            <tr><td>Brier Score</td><td>{report.drift.baseline.brierScore.toFixed(4)}</td><td>{report.drift.recent.brierScore.toFixed(4)}</td><td>{report.drift.changes.brier > 0 ? "+" : ""}{report.drift.changes.brier.toFixed(4)}</td></tr>
            <tr><td>ECE</td><td>{report.drift.baseline.ece.toFixed(4)}</td><td>{report.drift.recent.ece.toFixed(4)}</td><td>{report.drift.changes.ece > 0 ? "+" : ""}{report.drift.changes.ece.toFixed(4)}</td></tr>
            <tr><td>Average Probability</td><td>{report.drift.baseline.averageProbability.toFixed(1)}%</td><td>{report.drift.recent.averageProbability.toFixed(1)}%</td><td>{formatPercentage(report.drift.changes.probabilityPoints)}</td></tr>
            <tr><td>Accuracy</td><td>{report.drift.baseline.accuracy.toFixed(1)}%</td><td>{report.drift.recent.accuracy.toFixed(1)}%</td><td>{formatPercentage(report.drift.changes.accuracyPoints)}</td></tr>
          </tbody>
        </table></div>
      ) : null}

      <div className={styles.thresholdRow}>
        <span>Warning: Brier +0.03 • ECE +0.05 • Probability 5 pp • Accuracy −10 pp</span>
        <span>Critical: Brier +0.06 • ECE +0.10 • Probability 10 pp • Accuracy −20 pp</span>
      </div>
      <div className={styles.productionLock}><strong>AUTOMATIC ACTION DISABLED</strong><span>Health and drift alerts require investigation. The 20% ML / 80% Poisson Champion remains unchanged.</span></div>
    </section>
  );
}

function PortfolioTable({ selections, badge }: {
  selections: PortfolioSelection[];
  badge: "PRIMARY" | "WATCH";
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr>
          <th>MATCH</th><th>PICK</th><th>MODEL PROBABILITY</th><th>MARKET PROBABILITY</th>
          <th>EDGE</th><th>FAIR / BEST</th><th>EV</th><th>BOOKMAKER</th><th>PORTFOLIO STAKE</th>
        </tr></thead>
        <tbody>{selections.map(({ row, portfolioStakePercentage }) => (
          <tr key={`${row.matchId}-${row.marketKey}-${row.id ?? "live"}`}>
            <td><div className={styles.match}><strong>{row.homeTeam} – {row.awayTeam}</strong><span className={styles.meta}>{row.leagueName} • {formatDate(row.kickoffAt)}</span></div></td>
            <td><span className={`${styles.badge} ${badge === "PRIMARY" ? styles.primary : styles.watch}`}>{badge}</span><span className={styles.pick}>{row.market}<br /><strong>{row.selection}</strong></span></td>
            <td>{row.modelProbability.toFixed(1)}%</td><td>{row.marketProbability.toFixed(1)}%</td>
            <td className={styles.positive}>{formatPercentage(row.marketEdge)}</td>
            <td>{formatOdds(row.fairOdds)} / <strong>{formatOdds(row.bestOdds)}</strong></td>
            <td className={styles.positive}>{formatPercentage(row.expectedValue)}</td>
            <td>{row.bookmakerName}<br /><span className={styles.meta}>{formatBookmakerCount(row.bookmakerCount)}</span></td>
            <td className={portfolioStakePercentage > 0 ? styles.stake : undefined}>{portfolioStakePercentage.toFixed(2)}%</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default async function ValueBetsPage() {
  const snapshot = await loadValueBetDashboardSnapshot();
  const data = {
    ...snapshot,
    upcoming: snapshot.upcoming.filter((row) =>
      isDateInSeason(row.kickoffAt, ACTIVE_SEASON_YEAR),
    ),
    settled: snapshot.settled.filter((row) =>
      isDateInSeason(row.kickoffAt, ACTIVE_SEASON_YEAR),
    ),
  };
  const portfolio = buildValueBetPortfolio(data.upcoming);
  const accuracy = buildValueBetAccuracyReport(data.settled);
  const learning = buildValueBetLearningReport(data.settled);
  const leagueProfiles = buildValueBetLeagueProfileReport(data.settled);
  const championChallenger = buildChampionChallengerAudit(data.settled);
  const modelHealth = buildModelHealthReport({ generatedAt: data.generatedAt, upcoming: data.upcoming, settled: data.settled });

  return (
    <PageShell><div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            REAL BOOKMAKER ODDS • {ACTIVE_SEASON_LABEL} • MODEL HEALTH V2.7
          </p>
          <h1 className={styles.title}>Value Bets</h1>
          <p className={styles.subtitle}>One primary selection per match. Low-confidence candidates remain on watch, while same-match alternatives are shown without adding portfolio exposure.</p>
        </div>
        <span className={styles.modeBadge}>
          {ACTIVE_SEASON_LABEL} PRE-KICKOFF
        </span>
      </header>

      <section className={styles.metricGrid}>
        <article className={styles.metric}><span>MAIN RECOMMENDATIONS</span><strong>{portfolio.primarySelections.length}</strong><small>One strongest selection per match</small></article>
        <article className={styles.metric}><span>WATCH LIST</span><strong>{portfolio.watchSelections.length}</strong><small>Below portfolio confidence threshold</small></article>
        <article className={styles.metric}><span>ALTERNATIVES</span><strong>{portfolio.alternatives.length}</strong><small>Shown for context, not extra wagers</small></article>
        <article className={styles.metric}><span>MAXIMUM DAILY RISK</span><strong className={styles.positive}>{portfolio.maximumDailyAllocatedRiskPercentage.toFixed(2)}%</strong><small>Daily portfolio exposure, capped at 6%</small></article>
      </section>

      {portfolio.primarySelections.length === 0 ? (
        <section className={styles.emptyState}><h2>No primary recommendation right now</h2><p>Candidates may be unavailable or below the portfolio confidence threshold.</p></section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Main Recommendations</h2><p>Highest-ranked independent match selections. Daily total stake is capped at 6%.</p></div></div>
          <PortfolioTable selections={portfolio.primarySelections} badge="PRIMARY" />
          <AiMatchExplanations selections={portfolio.primarySelections} />
        </section>
      )}

      {portfolio.watchSelections.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Watch List</h2><p>Expected value below 5% or market edge below 3%. No stake is assigned.</p></div></div>
          <PortfolioTable selections={portfolio.watchSelections} badge="WATCH" />
        </section>
      )}

      {portfolio.alternatives.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Alternative Selections</h2><p>The same match already has a stronger main selection. Alternatives do not add portfolio risk.</p></div></div>
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>MATCH</th><th>PICK</th><th>MODEL PROBABILITY</th><th>MARKET PROBABILITY</th><th>EDGE</th><th>FAIR / BEST</th><th>EV</th><th>BOOKMAKER</th><th>PORTFOLIO STAKE</th></tr></thead>
            <tbody>{portfolio.alternatives.map(({ row }) => (
              <tr key={`${row.matchId}-${row.marketKey}-${row.id ?? "alternative"}`}>
                <td><div className={styles.match}><strong>{row.homeTeam} – {row.awayTeam}</strong><span className={styles.meta}>{row.leagueName} • {formatDate(row.kickoffAt)}</span></div></td>
                <td><span className={`${styles.badge} ${styles.alternative}`}>ALTERNATIVE</span><span className={styles.pick}>{row.market}<br /><strong>{row.selection}</strong></span></td>
                <td>{row.modelProbability.toFixed(1)}%</td><td>{row.marketProbability.toFixed(1)}%</td>
                <td className={styles.positive}>{formatPercentage(row.marketEdge)}</td><td>{formatOdds(row.fairOdds)} / <strong>{formatOdds(row.bestOdds)}</strong></td>
                <td className={styles.positive}>{formatPercentage(row.expectedValue)}</td><td>{row.bookmakerName}<br /><span className={styles.meta}>{formatBookmakerCount(row.bookmakerCount)}</span></td><td>0.00%</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <ValueBetAccuracyDashboard report={accuracy} />
      <HistoricalLearningPanel report={learning} />
      <LeagueProfilePanel report={leagueProfiles} />
      <ChampionChallengerPanel audit={championChallenger} />
      <ModelHealthPanel report={modelHealth} />

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Value Bet History</h2><p>Immutable prices and model probabilities captured before kickoff.</p></div></div>
        {data.settled.length === 0 ? (
          <div className={styles.emptyState}><h2>No settled Value Bets yet</h2><p>Results will appear automatically after final scores are imported.</p></div>
        ) : (
          <div className={styles.tableWrap}><table className={styles.table}>
            <thead><tr><th>MATCH</th><th>PICK</th><th>ODDS</th><th>EV</th><th>SCORE</th><th>RESULT</th><th>PROFIT</th></tr></thead>
            <tbody>{data.settled.map((row) => (
              <tr key={row.id ?? `${row.matchId}-${row.marketKey}`}>
                <td><div className={styles.match}><strong>{row.homeTeam} – {row.awayTeam}</strong><span className={styles.meta}>{row.leagueName} • {formatDate(row.kickoffAt)}</span></div></td>
                <td>{row.market}<br /><strong>{row.selection}</strong></td><td>{formatOdds(row.bestOdds)}</td>
                <td className={styles.positive}>{formatPercentage(row.expectedValue)}</td><td>{row.actualHomeScore ?? "—"} – {row.actualAwayScore ?? "—"}</td>
                <td><span className={`${styles.badge} ${row.result === "WON" ? styles.won : row.result === "LOST" ? styles.lost : styles.void}`}>{row.result}</span></td>
                <td className={(row.profitUnits ?? 0) >= 0 ? styles.positive : styles.negative}>{row.profitUnits?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <div className={styles.notice}>Value Bet is a statistical comparison, not a guarantee of profit. Portfolio stakes are capped at 6% per day and should remain within a separate betting bankroll.</div>
    </div></PageShell>
  );
}
