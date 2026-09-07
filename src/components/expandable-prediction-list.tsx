"use client";

import {
  useState,
} from "react";

import { useLanguage } from "@/components/language-provider";
import {
  PredictionCard,
} from "@/components/prediction-card";
import {
  PredictionDetailPanel,
} from "@/components/prediction-detail-panel";
import {
  BetMarketCatalogPanel,
} from "@/components/bet-market-catalog-panel";
import {
  getPredictionLabel,
  getTopPickReliability,
  getUiConfidence,
  type DashboardPrediction,
} from "@/lib/prediction-dashboard-shared";
import {
  buildBetMarketCatalog,
} from "@/lib/bet-market-catalog";

import styles from "./expandable-prediction-list.module.css";

type ExpandablePrediction =
  DashboardPrediction & {
    productionCandidateType?:
      | "PRIMARY_HOME"
      | "REVIEW_AWAY";
  };

type ExpandablePredictionListProps = {
  predictions:
    ExpandablePrediction[];

  showCandidateType?:
    boolean;
};

export function ExpandablePredictionList({
  predictions,
  showCandidateType = false,
}: ExpandablePredictionListProps) {
  const { t, locale } = useLanguage();

  const [
    selectedMatchId,
    setSelectedMatchId,
  ] =
    useState<number | null>(
      null,
    );

  return (
    <div className="prediction-list">
      {predictions.map(
        (
          prediction,
        ) => {
          const isSelected =
            selectedMatchId ===
            prediction.matchId;

          const strongestPick =
            prediction
              .topPicks[0];

          const marketCatalog =
            buildBetMarketCatalog({
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
              locale,
            });

          const togglePrediction =
            () => {
              setSelectedMatchId(
                (current) =>
                  current ===
                  prediction.matchId
                    ? null
                    : prediction.matchId,
              );
            };

          return (
            <div
              key={
                prediction.matchId
              }
              className="prediction-entry"
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={
                  isSelected
                }
                aria-controls={`match-analysis-${prediction.matchId}`}
                className={
                  isSelected
                    ? "prediction-clickable prediction-clickable-selected"
                    : "prediction-clickable"
                }
                onClick={
                  togglePrediction
                }
                onKeyDown={
                  (
                    event,
                  ) => {
                    if (
                      event.key ===
                        "Enter" ||
                      event.key ===
                        " "
                    ) {
                      event.preventDefault();
                      togglePrediction();
                    }
                  }
                }
              >
                {showCandidateType &&
                  prediction.productionCandidateType ===
                    "REVIEW_AWAY" && (
                    <span className={styles.reviewBadge}>
                      {t("Review Candidate")}
                    </span>
                  )}

                <PredictionCard
                  kickoffAt={
                    prediction.kickoffAt
                  }
                  leagueName={
                    prediction.leagueName
                  }
                  homeTeam={
                    prediction.homeTeam
                  }
                  awayTeam={
                    prediction.awayTeam
                  }
                  homeTeamLogo={
                    prediction.homeTeamLogo
                  }
                  awayTeamLogo={
                    prediction.awayTeamLogo
                  }
                  homeRecentResults={
                    prediction.homeRecentResults
                  }
                  awayRecentResults={
                    prediction.awayRecentResults
                  }
                  homeProbability={
                    prediction.homeProbability
                  }
                  drawProbability={
                    prediction.drawProbability
                  }
                  awayProbability={
                    prediction.awayProbability
                  }
                  expectedHomeGoals={
                    prediction.expectedHomeGoals
                  }
                  expectedAwayGoals={
                    prediction.expectedAwayGoals
                  }
                  bestPick={
                    getPredictionLabel(
                      prediction,
                    )
                  }
                  bestPickProbability={
                    strongestPick
                      ?.probability
                  }
                  confidence={
                    getUiConfidence(
                      getTopPickReliability(
                        prediction,
                      ),
                    )
                  }
                  confidenceScore={
                    getTopPickReliability(
                      prediction,
                    )
                  }
                  settlementStatus={
                    prediction.settlementStatus
                  }
                  finalHomeScore={
                    prediction.finalHomeScore
                  }
                  finalAwayScore={
                    prediction.finalAwayScore
                  }
                />

                <span className="match-analysis-toggle">
                  {isSelected
                    ? t("Hide analysis")
                    : t("Show analysis")}

                  <span aria-hidden="true">
                    {isSelected
                      ? "↑"
                      : "↓"}
                  </span>
                </span>
              </div>

              {isSelected && (
                <div
                  id={`match-analysis-${prediction.matchId}`}
                  className="prediction-inline-analysis"
                >
                  <div className={styles.marketCatalogArea}>
                    <BetMarketCatalogPanel
                      groups={marketCatalog}
                      locale={locale}
                      finalHomeScore={prediction.finalHomeScore}
                      finalAwayScore={prediction.finalAwayScore}
                    />
                  </div>

                  <details className={styles.modelAnalysisDetails}>
                    <summary>
                      {locale === "tr"
                        ? "Detaylı model analizini göster"
                        : "Show detailed model analysis"}
                    </summary>
                    <div className={styles.modelAnalysisContent}>
                      <PredictionDetailPanel prediction={prediction} />
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        },
      )}
    </div>
  );
}
