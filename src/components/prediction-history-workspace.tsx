"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import styles from "./prediction-history-workspace.module.css";
import { BET_MARKET_COUNT } from "@/lib/bet-market-catalog";

type PredictionSettlement = "WON" | "LOST" | "VOID";

export type HistoryPrediction = {
  id: number;
  matchId: number;
  leagueName: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  market: string;
  selection: string;
  predictedProbability: number;
  fairOdds: number | null;
  marketOdds: number | null;
  confidenceScore: number;
  dataQualityScore: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  result: PredictionSettlement;
  modelVersion: string;
  publishedAt: string;
};

type PredictionHistoryWorkspaceProps = {
  predictions: HistoryPrediction[];
};

type HistoryMode = "PROBABILITY" | "CONFIDENCE";
type BandKey = "ALL" | "0_49" | "50_59" | "60_69" | "70_79" | "80_89" | "90_100";

type BandDefinition = {
  key: BandKey;
  label: string;
  minimum: number;
  maximum: number | null;
};

const BANDS: BandDefinition[] = [
  { key: "ALL", label: "All", minimum: 0, maximum: null },
  { key: "0_49", label: "0–49%", minimum: 0, maximum: 50 },
  { key: "50_59", label: "50–59%", minimum: 50, maximum: 60 },
  { key: "60_69", label: "60–69%", minimum: 60, maximum: 70 },
  { key: "70_79", label: "70–79%", minimum: 70, maximum: 80 },
  { key: "80_89", label: "80–89%", minimum: 80, maximum: 90 },
  { key: "90_100", label: "90–100%", minimum: 90, maximum: null },
];

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatOdds(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function bandValue(prediction: HistoryPrediction, mode: HistoryMode): number {
  return mode === "CONFIDENCE"
    ? prediction.confidenceScore
    : prediction.predictedProbability;
}

function isInsideBand(value: number, band: BandDefinition): boolean {
  if (value < band.minimum) return false;
  return band.maximum === null || value < band.maximum;
}

function resultClass(result: PredictionSettlement): string {
  if (result === "WON") return "evaluation-result evaluation-correct";
  if (result === "LOST") return "evaluation-result evaluation-wrong";
  return "evaluation-result";
}

function formatSettlement(result: PredictionSettlement, tr: boolean): string {
  if (!tr) return result;
  if (result === "WON") return "KAZANDI";
  if (result === "LOST") return "KAYBETTİ";
  return "İADE";
}

export function PredictionHistoryWorkspace({
  predictions,
}: PredictionHistoryWorkspaceProps) {
  const { locale } = useLanguage();
  const tr = locale === "tr";
  const [mode, setMode] = useState<HistoryMode>("PROBABILITY");
  const [activeBand, setActiveBand] = useState<BandKey>("ALL");
  const [activeMarket, setActiveMarket] = useState("ALL");

  const markets = useMemo(() => {
    const unique = new Map<string, string>();
    for (const prediction of predictions) {
      unique.set(prediction.marketKey, prediction.market);
    }
    return [...unique.entries()].sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [predictions]);

  const activeDefinition =
    BANDS.find((band) => band.key === activeBand) ?? BANDS[0];

  const marketPredictions = useMemo(() => {
    if (activeMarket === "ALL") return predictions;
    return predictions.filter((prediction) => prediction.marketKey === activeMarket);
  }, [activeMarket, predictions]);

  const filteredPredictions = useMemo(() => {
    if (activeBand === "ALL") return marketPredictions;
    return marketPredictions.filter((prediction) =>
      isInsideBand(bandValue(prediction, mode), activeDefinition),
    );
  }, [activeBand, activeDefinition, marketPredictions, mode]);

  const statistics = useMemo(() => {
    const won = filteredPredictions.filter(
      (prediction) => prediction.result === "WON",
    ).length;
    const lost = filteredPredictions.filter(
      (prediction) => prediction.result === "LOST",
    ).length;
    const voided = filteredPredictions.filter(
      (prediction) => prediction.result === "VOID",
    ).length;
    const settled = won + lost;

    return {
      total: filteredPredictions.length,
      settled,
      won,
      lost,
      voided,
      accuracy: settled > 0 ? (won / settled) * 100 : null,
      averageProbability: average(
        filteredPredictions.map((prediction) => prediction.predictedProbability),
      ),
      averageConfidence: average(
        filteredPredictions.map((prediction) => prediction.confidenceScore),
      ),
    };
  }, [filteredPredictions]);

  const groupedMatches = useMemo(() => {
    const groups = new Map<number, HistoryPrediction[]>();

    for (const prediction of filteredPredictions) {
      const rows = groups.get(prediction.matchId) ?? [];
      rows.push(prediction);
      groups.set(prediction.matchId, rows);
    }

    return [...groups.entries()].map(([matchId, rows]) => ({
      matchId,
      rows,
      match: rows[0],
      won: rows.filter((row) => row.result === "WON").length,
      lost: rows.filter((row) => row.result === "LOST").length,
      voided: rows.filter((row) => row.result === "VOID").length,
    }));
  }, [filteredPredictions]);

  function changeMode(nextMode: HistoryMode): void {
    setMode(nextMode);
    setActiveBand("ALL");
  }

  return (
    <section className="evaluation-panel evaluation-history smart-history-panel">
      <div className="evaluation-panel-heading smart-history-heading">
        <div>
          <p className="eyebrow">{tr ? "TAHMİN GEÇMİŞİ" : "PREDICTION HISTORY"}</p>
          <h2>{tr ? "Sonuçlanmış Tahminler" : "Settled Prediction Results"}</h2>
          <p className="smart-history-description">
            {tr
              ? `Yayımlanmış seçimler maç bazında tek satırda özetlenir. Satırı açarak tahmin sonuçlarını, ${BET_MARKET_COUNT} pazarın tamamı için ayrı sonuç ekranını kullanarak tüm seçenekleri inceleyin.`
              : `Published picks are summarized in one row per match. Expand a row for pick results, or use the dedicated results page for all ${BET_MARKET_COUNT} markets.`}
          </p>
        </div>
        <div className={styles.headingActions}>
          <span className="evaluation-total">
            {groupedMatches.length} {tr ? "maç" : "matches"}
          </span>
          <Link className={styles.resultsLink} href="/prediction-results">
            {tr ? `${BET_MARKET_COUNT} PAZAR SONUÇLARI` : `${BET_MARKET_COUNT}-MARKET RESULTS`}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className={styles.compactToolbar}>
        <div className="history-mode-switch">
        <button
          type="button"
          className={
            mode === "PROBABILITY"
              ? "history-mode-button history-mode-button-active"
              : "history-mode-button"
          }
          onClick={() => changeMode("PROBABILITY")}
        >
          {tr ? "MODEL OLASILIĞI" : "MODEL PROBABILITY"}
        </button>
        <button
          type="button"
          className={
            mode === "CONFIDENCE"
              ? "history-mode-button history-mode-button-active"
              : "history-mode-button"
          }
          onClick={() => changeMode("CONFIDENCE")}
        >
          {tr ? "GÜVEN PUANI" : "RELIABILITY SCORE"}
        </button>
        </div>
        <label className={styles.marketControl}>
          <span className="history-mode-explanation">{tr ? "Bahis türü" : "Market"}</span>
          <select
            className={styles.marketSelect}
            value={activeMarket}
            onChange={(event) => {
              setActiveMarket(event.target.value);
              setActiveBand("ALL");
            }}
          >
            <option value="ALL">{tr ? "Tüm bahis türleri" : "All markets"}</option>
            {markets.map(([marketKey, market]) => (
              <option key={marketKey} value={marketKey}>
                {market}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.marketControl}>
          <span className="history-mode-explanation">
            {mode === "PROBABILITY"
              ? tr ? "Olasılık" : "Probability"
              : tr ? "Güven" : "Reliability"}
          </span>
          <select
            className={styles.bandSelect}
            value={activeBand}
            onChange={(event) => setActiveBand(event.target.value as BandKey)}
          >
            {BANDS.map((band) => (
              <option key={band.key} value={band.key}>
                {band.key === "ALL" ? (tr ? "Tüm aralıklar" : "All ranges") : band.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.compactSummary}>
        <article className="history-summary-primary">
          <span>{tr ? "Başarı" : "Accuracy"}</span>
          <strong>
            {statistics.accuracy === null
              ? "—"
              : formatPercentage(statistics.accuracy)}
          </strong>
          <small>{tr ? "Kazanan / sonuçlanan" : "Won / settled"}</small>
        </article>
        <article>
          <span>{tr ? "Maç" : "Matches"}</span>
          <strong>{groupedMatches.length}</strong>
          <small>{tr ? "Tekrarsız karşılaşma" : "Unique fixtures"}</small>
        </article>
        <article>
          <span>{tr ? "Kazandı" : "Won"}</span>
          <strong className="history-correct-value">{statistics.won}</strong>
          <small>{tr ? "Başarılı seçim" : "Successful picks"}</small>
        </article>
        <article>
          <span>{tr ? "Kaybetti" : "Lost"}</span>
          <strong className="history-wrong-value">{statistics.lost}</strong>
          <small>{tr ? "Başarısız seçim" : "Unsuccessful picks"}</small>
        </article>
        <article>
          <span>{tr ? "İade" : "Void"}</span>
          <strong>{statistics.voided}</strong>
          <small>{tr ? "Başarıdan hariç" : "Excluded from accuracy"}</small>
        </article>
      </div>

      {statistics.total === 0 ? (
        <div className="history-empty-state">
          {tr
            ? "Bu filtrelerle eşleşen sonuçlanmış tahmin bulunamadı."
            : "No settled archived predictions match these filters."}
        </div>
      ) : (
        <div className={styles.matchGroups}>
          {groupedMatches.map((group) => {
            const match = group.match;
            if (!match) return null;

            const finalScore =
              match.actualHomeScore === null || match.actualAwayScore === null
                ? "—"
                : `${match.actualHomeScore}-${match.actualAwayScore}`;

            return (
              <details className={styles.matchGroup} key={group.matchId}>
                <summary className={styles.matchSummary}>
                  <div className={styles.match}>
                    <strong>{match.homeTeam}</strong>
                    <span>vs</span>
                    <strong>{match.awayTeam}</strong>
                    <small>{match.leagueName} · {formatDate(match.kickoffAt)}</small>
                  </div>

                  <div className={styles.summaryScore}>
                    <span>{tr ? "Maç Sonucu" : "Final Score"}</span>
                    <strong>{finalScore}</strong>
                  </div>

                  <div className={styles.summaryCount}>
                    <strong>{group.rows.length}</strong>
                    <span>{tr ? "Tahmin" : "Predictions"}</span>
                  </div>

                  <div className={styles.summaryResults}>
                    <span className={styles.summaryWon}>{group.won} {tr ? "Kazandı" : "Won"}</span>
                    <span className={styles.summaryLost}>{group.lost} {tr ? "Kaybetti" : "Lost"}</span>
                    {group.voided > 0 ? <span>{group.voided} {tr ? "İade" : "Void"}</span> : null}
                  </div>

                  <span className={styles.toggleLabel}>
                    <span className={styles.closedLabel}>{tr ? "Detayı aç" : "Show details"}</span>
                    <span className={styles.openLabel}>{tr ? "Kapat" : "Hide details"}</span>
                    <b aria-hidden="true">⌄</b>
                  </span>
                </summary>

                <div className={styles.detailPanel}>
                  <div className={`${styles.detailRow} ${styles.detailHeader}`}>
                    <span>{tr ? "Bahis türü" : "Market"}</span>
                    <span>{tr ? "Seçim" : "Selection"}</span>
                    <span>{tr ? "Olasılık" : "Probability"}</span>
                    <span>{tr ? "Güven" : "Reliability"}</span>
                    <span>{tr ? "Adil / Piyasa Oranı" : "Fair / Market Odds"}</span>
                    <span>{tr ? "Sonuç" : "Result"}</span>
                  </div>

                  {group.rows.map((prediction) => (
                    <div className={styles.detailRow} key={prediction.id}>
                      <span>{prediction.market}</span>
                      <strong>{prediction.selection}</strong>
                      <strong>{formatPercentage(prediction.predictedProbability)}</strong>
                      <span>{prediction.confidenceScore.toFixed(0)}/100</span>
                      <span>{formatOdds(prediction.fairOdds)} / {formatOdds(prediction.marketOdds)}</span>
                      <span className={resultClass(prediction.result)}>
                        {formatSettlement(prediction.result, tr)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
