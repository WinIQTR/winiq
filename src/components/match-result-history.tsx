"use client";

import { useMemo, useState } from "react";
import styles from "@/app/match-result-performance/match-result-performance.module.css";

export type MatchResultHistoryRow = {
  id: number;
  matchId: number;
  leagueName: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  selection: "HOME" | "DRAW" | "AWAY";
  probability: number;
  fairOdds: number | null;
  confidenceScore: number;
  homeScore: number | null;
  awayScore: number | null;
  result: "WON" | "LOST" | "VOID";
};

type OutcomeFilter = "ALL" | "HOME" | "DRAW" | "AWAY";
type ResultFilter = "ALL" | "WON" | "LOST" | "VOID";
type ProbabilityRange = "ALL" | "30_39" | "40_49" | "50_59" | "60_69" | "70_100";

function selectionLabel(selection: MatchResultHistoryRow["selection"]): string {
  if (selection === "HOME") return "MS 1 · Ev Sahibi";
  if (selection === "DRAW") return "MS 0 · Beraberlik";
  return "MS 2 · Deplasman";
}

function resultLabel(result: MatchResultHistoryRow["result"]): string {
  if (result === "WON") return "KAZANDI";
  if (result === "LOST") return "KAYBETTİ";
  return "İADE";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function matchesProbabilityRange(value: number, range: ProbabilityRange): boolean {
  if (range === "ALL") return true;
  if (range === "30_39") return value >= 30 && value < 40;
  if (range === "40_49") return value >= 40 && value < 50;
  if (range === "50_59") return value >= 50 && value < 60;
  if (range === "60_69") return value >= 60 && value < 70;
  return value >= 70;
}

export function MatchResultHistory({ rows }: { rows: MatchResultHistoryRow[] }) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<OutcomeFilter>("ALL");
  const [result, setResult] = useState<ResultFilter>("ALL");
  const [probabilityRange, setProbabilityRange] = useState<ProbabilityRange>("ALL");
  const [visibleCount, setVisibleCount] = useState(50);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((row) => {
      const matchesQuery = !normalized ||
        `${row.homeTeam} ${row.awayTeam} ${row.leagueName}`
          .toLocaleLowerCase("tr-TR")
          .includes(normalized);
      return matchesQuery &&
        (outcome === "ALL" || row.selection === outcome) &&
        (result === "ALL" || row.result === result) &&
        matchesProbabilityRange(row.probability, probabilityRange);
    });
  }, [outcome, probabilityRange, query, result, rows]);

  const visibleRows = filteredRows.slice(0, visibleCount);

  function resetVisible(): void {
    setVisibleCount(50);
  }

  return (
    <section className={styles.historyPanel}>
      <header className={styles.panelHeading}>
        <div>
          <span>DOĞRULANMIŞ 1X2 FAVORİ ARŞİVİ</span>
          <h2>Modelin Favori Maç Sonucu Seçimleri</h2>
          <p>15 Ağustos 2026&apos;dan bugüne, MS 1 / MS 0 / MS 2 arasındaki en yüksek ve en az %30 olasılıklı seçimler.</p>
        </div>
        <strong>{filteredRows.length} kayıt</strong>
      </header>

      <div className={styles.filterBar}>
        <label className={styles.searchControl}>
          <span>TAKIM VEYA LİG ARA</span>
          <input
            value={query}
            placeholder="Takım adı yazın..."
            onChange={(event) => {
              setQuery(event.target.value);
              resetVisible();
            }}
          />
        </label>
        <label>
          <span>TAHMİN</span>
          <select value={outcome} onChange={(event) => {
            setOutcome(event.target.value as OutcomeFilter);
            resetVisible();
          }}>
            <option value="ALL">Tüm sonuçlar</option>
            <option value="HOME">MS 1 · Ev Sahibi</option>
            <option value="DRAW">MS 0 · Beraberlik</option>
            <option value="AWAY">MS 2 · Deplasman</option>
          </select>
        </label>
        <label>
          <span>GERÇEK SONUÇ</span>
          <select value={result} onChange={(event) => {
            setResult(event.target.value as ResultFilter);
            resetVisible();
          }}>
            <option value="ALL">Tümü</option>
            <option value="WON">Kazandı</option>
            <option value="LOST">Kaybetti</option>
            <option value="VOID">İade</option>
          </select>
        </label>
        <label>
          <span>MODEL OLASILIK ARALIĞI</span>
          <select value={probabilityRange} onChange={(event) => {
            setProbabilityRange(event.target.value as ProbabilityRange);
            resetVisible();
          }}>
            <option value="ALL">%30–100 · Tüm favoriler</option>
            <option value="30_39">%30–39,9</option>
            <option value="40_49">%40–49,9</option>
            <option value="50_59">%50–59,9</option>
            <option value="60_69">%60–69,9</option>
            <option value="70_100">%70–100</option>
          </select>
        </label>
      </div>

      {visibleRows.length === 0 ? (
        <div className={styles.emptyList}>Bu filtrelerle eşleşen tahmin bulunamadı.</div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.resultRow} ${styles.tableHead}`}>
            <span>Tarih / Lig</span>
            <span>Maç</span>
            <span>1X2 Model Favorisi</span>
            <span>Model</span>
            <span>Adil Oran</span>
            <span>Kesin Skor</span>
            <span>Sonuç</span>
          </div>
          {visibleRows.map((row) => (
            <article className={styles.resultRow} key={row.id}>
              <div className={styles.dateCell}>
                <strong>{formatDate(row.kickoffAt)}</strong>
                <span>{row.leagueName}</span>
              </div>
              <div className={styles.matchCell}>
                <strong>{row.homeTeam}</strong>
                <span>–</span>
                <strong>{row.awayTeam}</strong>
              </div>
              <strong className={styles.selectionCell}>{selectionLabel(row.selection)}</strong>
              <strong className={styles.probabilityCell}>%{row.probability.toFixed(1)}</strong>
              <span>{row.fairOdds?.toFixed(2) ?? "—"}</span>
              <strong className={styles.scoreCell}>
                {row.homeScore === null || row.awayScore === null
                  ? "—"
                  : `${row.homeScore} – ${row.awayScore}`}
              </strong>
              <span className={`${styles.resultBadge} ${styles[`result${row.result}`]}`}>
                {resultLabel(row.result)}
              </span>
            </article>
          ))}
        </div>
      )}

      {visibleCount < filteredRows.length ? (
        <button
          className={styles.loadMore}
          type="button"
          onClick={() => setVisibleCount((current) => current + 50)}
        >
          50 kayıt daha göster
        </button>
      ) : null}
    </section>
  );
}
