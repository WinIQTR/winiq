"use client";

import { useLanguage } from "@/components/language-provider";

import {
  getPredictionLabel,
  getPredictionReasons,
  getPredictionSummary,
  getUiConfidence,
  type DashboardPrediction,
  type UiConfidence,
} from "@/lib/prediction-dashboard-shared";

type PredictionDetailPanelProps = {
  prediction:
    DashboardPrediction;
};

function displayValue(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "—";
  }

  return value.toFixed(
    1,
  );
}

function comparisonTone(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "comparison-value comparison-value-neutral";
  if (value >= 65) return "comparison-value comparison-value-good";
  if (value < 50) return "comparison-value comparison-value-low";
  return "comparison-value comparison-value-close";
}

function getDisplayedFairOdds(
  probability: number,
): string {
  if (
    !Number.isFinite(probability) ||
    probability <= 0
  ) {
    return "—";
  }

  return (
    100 / probability
  ).toFixed(2);
}

function getConfidenceClass(
  confidence:
    UiConfidence,
): string {
  switch (
    confidence
  ) {
    case "Very High":
      return (
        "prediction-confidence-badge confidence-high"
      );

    case "High":
      return (
        "prediction-confidence-badge confidence-high"
      );

    case "Medium":
      return (
        "prediction-confidence-badge confidence-medium"
      );

    case "Low":
      return (
        "prediction-confidence-badge confidence-low"
      );

    case "Very Low":
      return (
        "prediction-confidence-badge confidence-low"
      );

    default:
      return (
        "prediction-confidence-badge confidence-low"
      );
  }
}

function getTierLabel(
  tier:
    | "VERY_HIGH"
    | "HIGH"
    | "MEDIUM"
    | "LOW",
): string {
  if (
    tier ===
    "VERY_HIGH"
  ) {
    return "VERY HIGH CONFIDENCE";
  }

  if (
    tier ===
    "HIGH"
  ) {
    return "HIGH CONFIDENCE";
  }

  if (
    tier ===
    "MEDIUM"
  ) {
    return "MEDIUM CONFIDENCE";
  }

  return "LOW CONFIDENCE";
}

function getTierClass(
  tier:
    | "VERY_HIGH"
    | "HIGH"
    | "MEDIUM"
    | "LOW",
): string {
  if (
    tier ===
      "VERY_HIGH" ||
    tier ===
      "HIGH"
  ) {
    return "confidence-high";
  }

  if (
    tier ===
    "MEDIUM"
  ) {
    return "confidence-medium";
  }

  return "confidence-low";
}

function getEdgeLabel(
  edge: string,
): string {
  switch (
    edge
  ) {
    case "STRONG_HOME":
      return "Strong home edge";

    case "HOME":
      return "Home edge";

    case "STRONG_AWAY":
      return "Strong away edge";

    case "AWAY":
      return "Away edge";

    case "BALANCED":
      return "Balanced";

    case "INSUFFICIENT_DATA":
      return "Insufficient data";

    default:
      return edge;
  }
}

export function PredictionDetailPanel({
  prediction,
}: PredictionDetailPanelProps) {
  const { t, locale } = useLanguage();
  const strongestPick =
    prediction.topPicks[0];

  const displayedConfidenceScore =
    strongestPick
      ?.reliabilityScore ??
    prediction.confidenceScore;

  const confidence =
    getUiConfidence(
      displayedConfidenceScore,
    );

  const reasons =
    getPredictionReasons(
      prediction,
    );

  const summary =
    getPredictionSummary(
      prediction,
    );

  return (
    <aside className="prediction-detail-panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">
            MATCH ANALYSIS
          </p>

          <h2>
            {prediction.homeTeam}
            {" vs "}
            {prediction.awayTeam}
          </h2>

          <p className="prediction-summary">
            {prediction.leagueName}
          </p>
        </div>

        <span
          className={
            getConfidenceClass(
              confidence,
            )
          }
        >
          {t(confidence)}
        </span>
      </div>

      <div className="detail-pick">
        <span>
          Strongest Overall Pick
        </span>

        <strong>
          {strongestPick
            ? `${t(strongestPick.market)} — ${t(strongestPick.selection)}`
            : t(getPredictionLabel(
                prediction,
              ))}
        </strong>

        {strongestPick ? (
          <>
            <div className="detail-primary-metrics">
              <div>
                <span>
                  Model Probability
                </span>

                <strong>
                  %
                  {strongestPick.probability.toFixed(
                    1,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Top Pick Confidence
                </span>

                <strong>
                  {strongestPick.reliabilityScore.toFixed(
                    0,
                  )}
                  /100
                </strong>
              </div>

              <div>
                <span>
                  Fair Odds
                </span>

                <strong>
                  {getDisplayedFairOdds(
                    strongestPick.probability,
                  )}
                </strong>
              </div>
            </div>

            <span
              className={`prediction-confidence-badge ${getTierClass(
                strongestPick.tier,
              )}`}
            >
              {getTierLabel(
                strongestPick.tier,
              )}
            </span>
          </>
        ) : (
          <b>
            %
            {prediction.predictedProbability.toFixed(
              1,
            )}
          </b>
        )}
      </div>

      <div className="detail-section">
        <h3>
          {locale === "tr"
            ? "Maç Sonucu Olasılıkları · 1X2"
            : "Match Result Probabilities · 1X2"}
        </h3>

        <div className="detail-probabilities">
          <div>
            <span>{locale === "tr" ? "MS 1 · Ev Sahibi" : "1 · Home"}</span>

            <strong>
              %
              {prediction.homeProbability.toFixed(
                1,
              )}
            </strong>
          </div>

          <div>
            <span>{locale === "tr" ? "MS 0 · Beraberlik" : "X · Draw"}</span>

            <strong>
              %
              {prediction.drawProbability.toFixed(
                1,
              )}
            </strong>
          </div>

          <div>
            <span>{locale === "tr" ? "MS 2 · Deplasman" : "2 · Away"}</span>

            <strong>
              %
              {prediction.awayProbability.toFixed(
                1,
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h3>
          Expected Goals
        </h3>

        <div className="comparison-table">
          <div className="comparison-head">
            <span />

            <strong>
              {prediction.homeTeam}
            </strong>

            <strong>
              {prediction.awayTeam}
            </strong>
          </div>

          <div>
            <span>
              xG
            </span>

            <strong>
              {prediction.expectedHomeGoals.toFixed(
                2,
              )}
            </strong>

            <strong>
              {prediction.expectedAwayGoals.toFixed(
                2,
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="detail-section detail-section-wide">
        <h3>
          Top 5 Popular Markets
        </h3>

        <p className="prediction-summary">
          Meaningful picks from commonly used markets,
          including match result, double chance, 2.5 goals,
          both teams to score and team goals.
        </p>

        {prediction.popularPicks.length ===
        0 ? (
          <p className="prediction-summary">
            No popular-market pick met the quality threshold
            for this match.
          </p>
        ) : (
          <div className="detail-top-picks-list">
            {prediction.popularPicks.map(
              (
                pick,
              ) => (
                <div
                  key={`popular-${pick.key}`}
                  className="detail-top-pick-row"
                >
                  <div className="detail-top-pick-rank">
                    #{pick.rank}
                  </div>

                  <div className="detail-top-pick-main">
                    <strong
                      className="detail-top-pick-market-name"
                      title={
                        pick.market
                      }
                    >
                      {t(pick.market)}
                    </strong>

                    <span className="detail-top-pick-selection">
                      {t(pick.selection)}
                    </span>
                  </div>

                  <div className="detail-top-pick-probability">
                    <span>
                      MODEL
                    </span>

                    <strong>
                      %
                      {pick.probability.toFixed(
                        1,
                      )}
                    </strong>
                  </div>

                  <div className="detail-top-pick-meta">
                    <div className="detail-reliability-value">
                      <span>
                        CONFIDENCE
                      </span>

                      <strong>
                        {pick.reliabilityScore.toFixed(
                          0,
                        )}
                        /100
                      </strong>
                    </div>

                    <span
                      className={`prediction-confidence-badge ${getTierClass(
                        pick.tier,
                      )}`}
                    >
                      {getTierLabel(
                        pick.tier,
                      )}
                    </span>

                    <small>
                      Fair Odds{" "}
                      {getDisplayedFairOdds(
                        pick.probability,
                      )}
                    </small>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="detail-section detail-section-wide">
        <h3>
          En Popüler Bahis Türleri
        </h3>

        <p className="prediction-summary">
          Model olasılığı bu maça özeldir. Popüler bahis türleri
          sabit bir sırayla listelenir; bazıları için (kart, korner,
          ofsayt, şut, oyuncu golü, ilk yarı) gerekli veri/model bu projede
          henüz mevcut değil ve bu satırlar açıkça belirtilir —
          tahmini bir sayı gösterilmez.
        </p>

        <div className="detail-top-picks-list">
          {(prediction.popularMarketsSummary ?? []).map(
            (row, index) => (
              <div
                key={`popular-${index}`}
                className="detail-top-pick-row"
              >
                <div className="detail-top-pick-rank">
                  #{index + 1}
                </div>

                <div className="detail-top-pick-main">
                  <strong className="detail-top-pick-market-name">
                    {row.label}
                  </strong>

                  {row.supported ? (
                    <span className="detail-top-pick-selection">
                      {row.market ? `${row.market} · ` : ""}
                      {row.selection}
                      {row.isEstimate && (
                        <span className="popular-market-estimate-badge">
                          TAHMİNİ MODEL
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="detail-top-pick-selection popular-market-unsupported">
                      {row.unsupportedReason}
                    </span>
                  )}
                </div>

                {row.supported ? (
                  <>
                    <div className="detail-top-pick-probability">
                      <span>MODEL</span>
                      <strong>
                        %{(row.probability ?? 0).toFixed(1)}
                      </strong>
                    </div>

                    <div className="detail-top-pick-meta">
                      <span className="detail-reliability-value">
                        <span>ADİL ORAN</span>
                        <strong>
                          {row.fairOdds ? row.fairOdds.toFixed(2) : "—"}
                        </strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="popular-market-unsupported-badge">
                    DESTEKLENMİYOR
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <div className="detail-section detail-section-wide">
        <h3>
          10 Safest Markets
        </h3>

        <p className="prediction-summary">
          Model probability reflects this match, while reliability
          reflects the market&apos;s historical performance. High-probability
          markets with low fair odds may appear here.
        </p>

        {prediction.topPicks.length ===
        0 ? (
          <p className="prediction-summary">
            No market met the quality threshold for this match.
          </p>
        ) : (
          <div className="detail-top-picks-list">
            {prediction.topPicks.map(
              (
                pick,
              ) => (
                <div
                  key={`safe-${pick.key}`}
                  className="detail-top-pick-row"
                >
                  <div className="detail-top-pick-rank">
                    #{pick.rank}
                  </div>

                  <div className="detail-top-pick-main">
                    <strong
                      className="detail-top-pick-market-name"
                      title={
                        pick.market
                      }
                    >
                      {t(pick.market)}
                    </strong>

                    <span className="detail-top-pick-selection">
                      {t(pick.selection)}
                    </span>
                  </div>

                  <div className="detail-top-pick-probability">
                    <span>
                      MODEL
                    </span>

                    <strong>
                      %
                      {pick.probability.toFixed(
                        1,
                      )}
                    </strong>
                  </div>

                  <div className="detail-top-pick-meta">
                    <div className="detail-reliability-value">
                      <span>
                        CONFIDENCE
                      </span>

                      <strong>
                        {pick.reliabilityScore.toFixed(
                          0,
                        )}
                        /100
                      </strong>
                    </div>

                    <span
                      className={`prediction-confidence-badge ${getTierClass(
                        pick.tier,
                      )}`}
                    >
                      {getTierLabel(
                        pick.tier,
                      )}
                    </span>

                    <small>
                      Fair Odds{" "}
                      {getDisplayedFairOdds(
                        pick.probability,
                      )}
                    </small>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="detail-section">
        <h3>
          Why This Pick?
        </h3>

        <p className="prediction-summary">
          {t(summary)}
        </p>

        <div className="reason-list">
          {reasons.map(
            (
              reason,
              index,
            ) => (
              <div
                key={`${reason.label}-${index}`}
                className={
                  reason.tone ===
                  "POSITIVE"
                    ? "reason-item reason-positive"
                    : reason.tone ===
                        "NEGATIVE"
                      ? "reason-item reason-negative"
                      : "reason-item reason-neutral"
                }
              >
                <span className="reason-symbol">
                  {reason.tone ===
                  "POSITIVE"
                    ? "↑"
                    : reason.tone ===
                        "NEGATIVE"
                      ? "↓"
                      : "•"}
                </span>

                <div>
                  <strong>
                    {t(reason.label)}
                  </strong>

                  <p>
                    {t(reason.description)}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="detail-section detail-team-comparison">
        <h3>
          Team Comparison
        </h3>

        <div className="comparison-table">
          <div className="comparison-head">
            <span />

            <strong>
              {prediction.homeTeam}
            </strong>

            <strong>
              {prediction.awayTeam}
            </strong>
          </div>

          <div>
            <span>
              Overall Strength
            </span>

            <strong className={comparisonTone(prediction.homeRating)}>
              {displayValue(
                prediction.homeRating,
              )}
            </strong>

            <strong className={comparisonTone(prediction.awayRating)}>
              {displayValue(
                prediction.awayRating,
              )}
            </strong>
          </div>

          <div>
            <span>
              Attack
            </span>

            <strong className={comparisonTone(prediction.homeAttack)}>
              {displayValue(
                prediction.homeAttack,
              )}
            </strong>

            <strong className={comparisonTone(prediction.awayAttack)}>
              {displayValue(
                prediction.awayAttack,
              )}
            </strong>
          </div>

          <div>
            <span>
              Defense
            </span>

            <strong className={comparisonTone(prediction.homeDefense)}>
              {displayValue(
                prediction.homeDefense,
              )}
            </strong>

            <strong className={comparisonTone(prediction.awayDefense)}>
              {displayValue(
                prediction.awayDefense,
              )}
            </strong>
          </div>

          <div>
            <span>
              Form
            </span>

            <strong className={comparisonTone(prediction.homeForm)}>
              {displayValue(
                prediction.homeForm,
              )}
            </strong>

            <strong className={comparisonTone(prediction.awayForm)}>
              {displayValue(
                prediction.awayForm,
              )}
            </strong>
          </div>

          <div>
            <span>
              Fitness
            </span>

            <strong className={comparisonTone(prediction.homeFitness)}>
              {displayValue(
                prediction.homeFitness,
              )}
            </strong>

            <strong className={comparisonTone(prediction.awayFitness)}>
              {displayValue(
                prediction.awayFitness,
              )}
            </strong>
          </div>
        </div>
      </div>

      <div className="detail-section detail-model-information">
        <h3>
          Model Information
        </h3>

        <div className="detail-stat">
          <span>
            Market Count
          </span>

          <strong>
            {prediction.marketCount}
          </strong>
        </div>

        <div className="detail-stat">
          <span>
            Popular Pick Count
          </span>

          <strong>
            {prediction.popularPicks.length}
          </strong>
        </div>

        <div className="detail-stat">
          <span>
            Safe Market Count
          </span>

          <strong>
            {prediction.topPicks.length}
          </strong>
        </div>

        <div className="detail-stat">
          <span>
            Rating Difference
          </span>

          <strong>
            {displayValue(
              prediction.ratingDifference,
            )}
          </strong>
        </div>

        <div className="detail-stat">
          <span>
            Rating Edge
          </span>

          <strong>
            {getEdgeLabel(
              prediction.ratingEdge,
            )}
          </strong>
        </div>

        <div className="detail-stat">
          <span>
            Match Result Confidence
          </span>

          <strong>
            {prediction.confidenceScore.toFixed(
              0,
            )}
            /100
          </strong>
        </div>
      </div>

      {prediction.warnings.length >
        0 && (
        <div className="detail-section detail-warnings">
          <h3>
            Warnings
          </h3>

          <ul className="detail-warning-list">
            {prediction.warnings
              .slice(
                0,
                5,
              )
              .map(
                (
                  warning,
                  index,
                ) => (
                  <li
                    key={`${index}-${warning}`}
                  >
                    {t(warning)}
                  </li>
                ),
              )}
          </ul>
        </div>
      )}
    </aside>
  );
}
