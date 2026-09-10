import Link from "next/link";

import {
  MetricCard,
} from "@/components/metric-card";

import {
  PageShell,
} from "@/components/page-shell";

import {
  ExpandablePredictionList,
} from "@/components/expandable-prediction-list";

import {
  ACTIVE_SEASON_YEAR,
  isDateInSeason,
} from "@/config/season";

import {
  loadDashboardPredictionSnapshot,
} from "@/lib/prediction-dashboard-snapshot";

import { requireAdmin } from "@/lib/auth-session";

import {
  SELECTION_POLICY_V2_THRESHOLDS,
} from "@/lib/selection-policy-explanation";

import {
  selectStrongestDashboardPredictions,
} from "@/lib/daily-strongest-predictions";

function formatPercentage(
  value: number,
): string {
  return `${value.toFixed(1)}%`;
}

export default async function HomePage() {
  await requireAdmin();

  const snapshotPredictions =
    await loadDashboardPredictionSnapshot(
      5_000,
    );

  const predictions =
    snapshotPredictions.filter(
      (prediction) =>
        isDateInSeason(
          prediction.kickoffAt,
          ACTIVE_SEASON_YEAR,
        ),
    );

  const primaryHomeCandidates =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.productionCandidateType ===
        "PRIMARY_HOME",
    );

  const reviewAwayCandidates =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.productionCandidateType ===
        "REVIEW_AWAY",
    );

  const strongestSelection =
    selectStrongestDashboardPredictions(
      primaryHomeCandidates,
      predictions,
    );

  const strongestPredictions =
    strongestSelection.predictions;

  const strongestHeading =
    strongestSelection.mode === "STRICT_TODAY"
      ? "Today's Strongest Fixtures"
      : strongestSelection.mode === "BEST_TODAY"
        ? "Today's Best Available Fixtures"
        : strongestSelection.mode === "UPCOMING"
          ? "Strongest Upcoming Fixtures"
          : "Best Available Fixtures";

  const strongestDescription =
    strongestSelection.mode === "STRICT_TODAY"
      ? `Today in Türkiye time, ordered by kickoff. HOME outcome only, at least ${SELECTION_POLICY_V2_THRESHOLDS.minimumProbability}% probability, HIGH/VERY HIGH reliability, and ${SELECTION_POLICY_V2_THRESHOLDS.minimumDataQuality}+ data quality.`
      : strongestSelection.mode === "BEST_TODAY"
        ? "No fixture met every strict publication rule today. Showing today's highest-scoring available model candidates instead."
        : strongestSelection.mode === "UPCOMING"
          ? "No suitable fixture is scheduled today. Showing the highest-scoring candidates from the upcoming fixture window."
          : "Showing the highest-scoring candidates currently available in the published snapshot.";

  const veryHighConfidenceCount =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.confidenceLevel ===
        "VERY_HIGH",
    ).length;

  const highConfidenceCount =
    predictions.filter(
      (
        prediction,
      ) =>
        prediction.confidenceLevel ===
          "HIGH" ||
        prediction.confidenceLevel ===
          "VERY_HIGH",
    ).length;

  const averageConfidence =
    predictions.length >
    0
      ? predictions.reduce(
          (
            total,
            prediction,
          ) =>
            total +
            prediction.confidenceScore,
          0,
        ) /
        predictions.length
      : 0;

  const averagePredictionProbability =
    predictions.length >
    0
      ? predictions.reduce(
          (
            total,
            prediction,
          ) =>
            total +
            prediction.predictedProbability,
          0,
        ) /
        predictions.length
      : 0;

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">
            AI FOOTBALL PREDICTIONS
            {" • "}
            {ACTIVE_SEASON_YEAR}
          </p>

          <h1>
            Prediction Dashboard
          </h1>

          <p className="subtitle">
            Production candidates from upcoming fixtures, validated by the
            20% ML / 80% Poisson model and Selection Policy V2.
          </p>
        </div>

        <span className="mode-badge">
          PUBLISHED DATA
        </span>
      </header>

      <section className="metric-grid dashboard-metrics">
        <MetricCard
          label="Production Candidates"
          value={
            predictions.length
          }
          description={`${primaryHomeCandidates.length} primary HOME candidates`}
        />

        <MetricCard
          label="High Reliability"
          value={
            highConfidenceCount
          }
          description={`${veryHighConfidenceCount} very high`}
        />

        <MetricCard
          label="Average Reliability"
          value={
            formatPercentage(
              averageConfidence,
            )
          }
          description="Combined model reliability"
        />

        <MetricCard
          label="Average Probability"
          value={
            formatPercentage(
              averagePredictionProbability,
            )
          }
          description="Final 1X2 probability"
        />

        <MetricCard
          label="AWAY Review"
          value={
            reviewAwayCandidates.length
          }
          description="Limited holdout sample"
        />
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-primary-column">
          <article className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <p className="eyebrow">
                  TOP PREDICTIONS
                </p>

                <h2>
                  {strongestHeading}
                </h2>

                <p className="dashboard-muted">
                  {strongestDescription}
                </p>
              </div>

              <Link
                href="/predictions"
                className="dashboard-link"
              >
                View All Predictions →
              </Link>
            </div>

            {strongestPredictions.length ===
            0 ? (
              <div className="empty-state">
                <h2>
                  No Strong Predictions Today
                </h2>

                <p>
                  No primary HOME candidate meets the publication criteria
                  today in Türkiye time.
                </p>

                <p>
                  Run the archive job after refreshing fixtures to publish the
                  next dashboard snapshot.
                </p>
              </div>
            ) : (
              <div className="dashboard-prediction-list">
                <ExpandablePredictionList
                  predictions={
                    strongestPredictions
                  }
                />
              </div>
            )}
          </article>
        </div>

        <aside className="dashboard-side-column">
          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="eyebrow">
                  LIVE PIPELINE
                </p>

                <h2>
                  Active Prediction Pipeline
                </h2>
              </div>

              <Link
                href="/predictions"
                className="dashboard-link"
              >
                Open →
              </Link>
            </div>

            <div className="dashboard-validation-block">
              <span>
                Prediction Flow
              </span>

              <strong>
                %20 ML
                {" → "}
                %80 Poisson
                {" → "}
                Policy V2
              </strong>

              <small>
                DRAW is audit-only and does not change the production outcome.
              </small>
            </div>

            <div className="dashboard-rule-grid">
              <div>
                <span>
                  Active Season
                </span>

                <strong>
                  {ACTIVE_SEASON_YEAR}
                </strong>
              </div>

              <div>
                <span>
                  Total Candidates
                </span>

                <strong>
                  {predictions.length}
                </strong>
              </div>

              <div>
                <span>
                  Primary HOME
                </span>

                <strong>
                  {primaryHomeCandidates.length}
                </strong>
              </div>

              <div>
                <span>
                  AWAY Review
                </span>

                <strong>
                  {reviewAwayCandidates.length}
                </strong>
              </div>
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-heading">
              <div>
                <p className="eyebrow">
                  MARKET STRUCTURE
                </p>

                <h2>
                  Publication Filter
                </h2>
              </div>
            </div>

            <div className="dashboard-performance-list">
              <div>
                  <span>
                  Prediction Outcome
                </span>

                <strong>
                  HOME / AWAY
                </strong>
              </div>

              <div>
                <span>
                  Minimum Probability
                </span>

                <strong>
                  {SELECTION_POLICY_V2_THRESHOLDS.minimumProbability}%
                </strong>
              </div>

              <div>
                <span>
                  Reliability Tier
                </span>

                <strong>
                  HIGH / VERY_HIGH
                </strong>
              </div>

              <div>
                <span>
                  Data Quality
                </span>

                <strong>
                  {SELECTION_POLICY_V2_THRESHOLDS.minimumDataQuality} minimum
                </strong>
              </div>

              <div>
                <span>
                  DRAW
                </span>

                <strong>
                  Audit only
                </strong>
              </div>
            </div>
          </article>

          <article className="dashboard-panel">
            <p className="eyebrow">
              MODEL HEALTH
            </p>

            <h2>
              System Status
            </h2>

            <div className="dashboard-system-status">
              <div>
                <span className="status-dot" />

                <span>
                  PostgreSQL
                </span>

                <strong>
                  Active
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  Feature Engine
                </span>

                <strong>
                  V2
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  Rating Engine
                </span>

                <strong>
                  V2
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  Prediction Engine
                </span>

                <strong>
                  20/80 Production
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  Market Engine
                </span>

                <strong>
                  Active
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  Top Picks
                </span>

                <strong>
                  Selection Policy V2
                </strong>
              </div>

              <div>
                <span className="status-dot" />

                <span>
                  API-Football
                </span>

                <strong>
                  Connected
                </strong>
              </div>
            </div>
          </article>

          <article className="dashboard-panel">
            <p className="eyebrow">
              CONFIDENCE
            </p>

            <h2>
              Reliability Distribution
            </h2>

            <div className="dashboard-performance-list">
              <div>
                <span>
                  Very High
                </span>

                <strong>
                  {
                    predictions.filter(
                      (
                        prediction,
                      ) =>
                        prediction.confidenceLevel ===
                        "VERY_HIGH",
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  High
                </span>

                <strong>
                  {
                    predictions.filter(
                      (
                        prediction,
                      ) =>
                        prediction.confidenceLevel ===
                        "HIGH",
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Medium
                </span>

                <strong>
                  {
                    predictions.filter(
                      (
                        prediction,
                      ) =>
                        prediction.confidenceLevel ===
                        "MEDIUM",
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Low
                </span>

                <strong>
                  {
                    predictions.filter(
                      (
                        prediction,
                      ) =>
                        prediction.confidenceLevel ===
                          "LOW" ||
                        prediction.confidenceLevel ===
                          "VERY_LOW",
                    ).length
                  }
                </strong>
              </div>
            </div>
          </article>
        </aside>
      </section>

      <div className="dashboard-disclaimer">
        Odds shown here are fair odds calculated from model probabilities, not
        bookmaker prices. Value Bet comparisons will appear separately after
        live bookmaker odds are connected.
      </div>
    </PageShell>
  );
}
