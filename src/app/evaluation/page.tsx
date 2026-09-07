import { PageShell } from "@/components/page-shell";
import type { CSSProperties } from "react";
import { PredictionHistoryWorkspace } from "@/components/prediction-history-workspace";
import { evaluatePredictions } from "@/lib/prediction-evaluation";
import {
  ACTIVE_SEASON_LABEL,
  ACTIVE_SEASON_YEAR,
} from "@/config/season";
import styles from "./evaluation-page.module.css";

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatSignedPercentage(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatOdds(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function formatMarketName(value: string): string {
  return value
    .replace(/^Home Team Goals/i, "Ev Sahibi Takım Golleri")
    .replace(/^Away Team Goals/i, "Deplasman Takım Golleri")
    .replace(/^Total Goals/i, "Toplam Gol")
    .replace(/^Both Teams To Score$/i, "Karşılıklı Gol")
    .replace(/^Double Chance$/i, "Çifte Şans")
    .replace(/^Draw No Bet$/i, "Beraberlikte İade")
    .replace(/^Home Win To Nil$/i, "Ev Sahibi Gol Yemeden Kazanır")
    .replace(/^Away Win To Nil$/i, "Deplasman Gol Yemeden Kazanır")
    .replace(/^Match Result$/i, "Maç Sonucu");
}

function getCalibrationClass(gap: number): string {
  const absoluteGap = Math.abs(gap);

  if (absoluteGap <= 5) return styles.calibrationGood;
  if (absoluteGap <= 10) return styles.calibrationMedium;
  return styles.calibrationPoor;
}

export default async function EvaluationPage() {
  const { summary, predictions } = await evaluatePredictions(
    500,
    ACTIVE_SEASON_YEAR,
  );
  const hasHistoricalData = summary.totalPredictions > 0;
  const uniqueMatches = new Set(predictions.map((prediction) => prediction.matchId)).size;
  const settledBuckets = summary.probabilityBuckets.filter(
    (bucket) => bucket.settledPredictions > 0,
  );
  const weightedCalibrationGap = settledBuckets.length > 0
    ? settledBuckets.reduce(
        (total, bucket) =>
          total + Math.abs(bucket.calibrationGap) * bucket.settledPredictions,
        0,
      ) / settledBuckets.reduce(
        (total, bucket) => total + bucket.settledPredictions,
        0,
      )
    : 0;
  const bestMarket = [...summary.marketPerformance]
    .filter((market) => market.settledPredictions > 0)
    .sort((left, right) =>
      right.accuracy - left.accuracy ||
      right.settledPredictions - left.settledPredictions,
    )[0] ?? null;
  const modelHealth = summary.settledPredictions < 30
    ? "VERİ BİRİKİYOR"
    : summary.accuracy >= 65
      ? "GÜÇLÜ"
      : summary.accuracy >= 52
        ? "DENGELİ"
        : "GELİŞTİRİLMELİ";
  const modelHealthTone = summary.settledPredictions < 30
    ? styles.healthStable
    : summary.accuracy >= 65
      ? styles.healthStrong
      : summary.accuracy >= 52
        ? styles.healthStable
        : styles.healthReview;

  return (
    <PageShell>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>
              ÜRETİM ARŞİVİ • {ACTIVE_SEASON_LABEL}
            </p>
            <h1 className={styles.title}>Akıllı Tahmin Performansı</h1>
            <p className={styles.subtitle}>
              Yayımlanmış tahminlerin gerçek maç sonuçlarına göre doğrulanmış,
              sade ve karşılaştırılabilir performans merkezi. Yalnızca maçtan
              önce arşivlenen {ACTIVE_SEASON_LABEL} kayıtları kullanılır.
            </p>
            <div className={styles.heroChips}>
              <span>%20 ML / %80 POISSON</span>
              <span>{uniqueMatches} SONUÇLANMIŞ MAÇ</span>
              <span>DEĞİŞMEZ ARŞİV</span>
            </div>
          </div>

          {hasHistoricalData ? (
            <aside className={`${styles.healthCard} ${modelHealthTone}`}>
              <div
                className={styles.accuracyRing}
                style={{ "--accuracy": `${summary.accuracy * 3.6}deg` } as CSSProperties}
              >
                <div>
                  <strong>{formatPercentage(summary.accuracy)}</strong>
                  <span>BAŞARI</span>
                </div>
              </div>
              <div className={styles.healthCopy}>
                <span>MODEL SAĞLIĞI</span>
                <strong>{modelHealth}</strong>
                <small>
                  {summary.wonPredictions} kazandı · {summary.lostPredictions} kaybetti
                </small>
              </div>
            </aside>
          ) : (
            <span className={styles.modeBadge}>{ACTIVE_SEASON_LABEL} ARŞİVİ</span>
          )}
        </header>

        {!hasHistoricalData ? (
          <section className={styles.emptyState}>
            <h2>Henüz sonuçlanmış arşiv tahmini yok</h2>
            <p>
              Performans ekranı yalnızca maçtan önce arşivlenmiş ve daha sonra
              Kazandı, Kaybetti veya İade olarak sonuçlandırılmış tahminleri okur.
            </p>
            <p>
              Veri çalışması tahminleri maç başlamadan yayımlamalı, kesin skorlar
              geldikten sonra sonuçlandırmalıdır. Geçmiş maçlara sonradan tahmin
              üretilmez.
            </p>
          </section>
        ) : (
          <>
            <section className={styles.kpiGrid}>
              <article className={`${styles.kpiCard} ${styles.kpiBlue}`}>
                <div className={styles.kpiIcon}>01</div>
                <div className={styles.kpiContent}>
                  <span>ARŞİVLENEN TAHMİN</span>
                  <strong>{summary.totalPredictions}</strong>
                  <small>{uniqueMatches} farklı maçta kayıtlı</small>
                </div>
              </article>

              <article className={`${styles.kpiCard} ${styles.kpiGreen}`}>
                <div className={styles.kpiIcon}>02</div>
                <div className={styles.kpiContent}>
                  <span>GENEL BAŞARI</span>
                  <strong>{formatPercentage(summary.accuracy)}</strong>
                  <small>
                    {summary.wonPredictions} kazandı / {summary.lostPredictions} kaybetti
                  </small>
                </div>
              </article>

              <article className={`${styles.kpiCard} ${styles.kpiPurple}`}>
                <div className={styles.kpiIcon}>03</div>
                <div className={styles.kpiContent}>
                  <span>YÜKSEK GÜVEN BAŞARISI</span>
                  <strong>{formatPercentage(summary.highConfidenceAccuracy)}</strong>
                  <small>{summary.highConfidencePredictions} sonuçlanmış seçim</small>
                </div>
              </article>

              <article className={`${styles.kpiCard} ${styles.kpiYellow}`}>
                <div className={styles.kpiIcon}>04</div>
                <div className={styles.kpiContent}>
                  <span>ORTALAMA OLASILIK</span>
                  <strong>
                    {formatPercentage(summary.averagePredictedProbability)}
                  </strong>
                  <small>Ortalama adil oran {formatOdds(summary.averageFairOdds)}</small>
                </div>
              </article>
            </section>

            <section className={styles.insightGrid}>
              <article className={styles.insightCard}>
                <span className={styles.insightIndex}>01</span>
                <div>
                  <small>EN BAŞARILI BAHİS TÜRÜ</small>
                  <strong>{bestMarket ? formatMarketName(bestMarket.market) : "Yeterli veri yok"}</strong>
                  <p>
                    {bestMarket
                      ? `${formatPercentage(bestMarket.accuracy)} başarı · ${bestMarket.settledPredictions} seçim`
                      : "Sonuçlanan pazar örneği bekleniyor."}
                  </p>
                </div>
              </article>
              <article className={styles.insightCard}>
                <span className={styles.insightIndex}>02</span>
                <div>
                  <small>KALİBRASYON FARKI</small>
                  <strong>±{weightedCalibrationGap.toFixed(1)} puan</strong>
                  <p>Model olasılığı ile gerçekleşen sonuç arasındaki ağırlıklı fark.</p>
                </div>
              </article>
              <article className={styles.insightCard}>
                <span className={styles.insightIndex}>03</span>
                <div>
                  <small>YÜKSEK GÜVEN ETKİSİ</small>
                  <strong>
                    {summary.highConfidencePredictions > 0
                      ? formatSignedPercentage(
                          summary.highConfidenceAccuracy - summary.accuracy,
                        )
                      : "Veri bekleniyor"}
                  </strong>
                  <p>Yüksek güvenli seçimlerin genel başarıya göre performansı.</p>
                </div>
              </article>
            </section>

            <section className={styles.performanceGrid}>
              <article className={`${styles.panel} ${styles.marketPanel}`}>
                <div className={styles.compactPanelHeader}>
                  <div>
                    <div className={styles.panelTitle}>BAHİS TÜRÜNE GÖRE PERFORMANS</div>
                    <small>Başarı, örneklem ve sonuç dağılımı tek görünümde</small>
                  </div>
                  <span>{summary.marketPerformance.length} PAZAR</span>
                </div>
                <div className={styles.performanceList}>
                  {summary.marketPerformance.map((market) => (
                    <div className={styles.performanceItem} key={market.marketKey}>
                      <span className={styles.marketRank}>
                        {String(summary.marketPerformance.indexOf(market) + 1).padStart(2, "0")}
                      </span>
                      <div className={styles.performanceMeta}>
                        <strong>{formatMarketName(market.market)}</strong>
                        <small className={styles.marketResults}>
                          <span className={styles.resultWon}>{market.wonPredictions} kazandı</span>
                          <span className={styles.resultLost}>{market.lostPredictions} kaybetti</span>
                          {market.voidPredictions > 0
                            ? <span>{market.voidPredictions} iade</span>
                            : null}
                        </small>
                      </div>
                      <div className={styles.marketAccuracy}>
                        <b
                          className={
                            market.accuracy >= 65
                              ? styles.good
                              : market.accuracy >= 50
                                ? styles.medium
                                : styles.poor
                          }
                        >
                          {formatPercentage(market.accuracy)}
                        </b>
                        <div className={styles.progressTrack} aria-hidden="true">
                          <span
                            className={styles.progressFill}
                            style={{ width: `${Math.min(100, Math.max(0, market.accuracy))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className={styles.performanceTotal}>
                    <div>
                      <strong>Tüm Bahis Türleri</strong>
                      <span>{summary.settledPredictions} sonuçlanmış seçim</span>
                    </div>
                    <b>{formatPercentage(summary.accuracy)}</b>
                  </div>
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelTitle}>GÜVEN SEVİYESİNE GÖRE</div>
                <div className={styles.confidenceList}>
                  <div className={styles.confidenceItem}>
                    <div className={styles.confidenceMeta}>
                      <strong>Yüksek Güven</strong>
                      <small>{summary.highConfidencePredictions} seçim</small>
                    </div>
                    <b className={styles.good}>
                      {formatPercentage(summary.highConfidenceAccuracy)}
                    </b>
                    <div className={styles.confidenceBar}><span style={{ width: `${summary.highConfidenceAccuracy}%` }} /></div>
                  </div>
                  <div className={styles.confidenceItem}>
                    <div className={styles.confidenceMeta}>
                      <strong>Orta Güven</strong>
                      <small>{summary.mediumConfidencePredictions} seçim</small>
                    </div>
                    <b className={styles.medium}>
                      {formatPercentage(summary.mediumConfidenceAccuracy)}
                    </b>
                    <div className={styles.confidenceBar}><span style={{ width: `${summary.mediumConfidenceAccuracy}%` }} /></div>
                  </div>
                  <div className={styles.confidenceItem}>
                    <div className={styles.confidenceMeta}>
                      <strong>Düşük Güven</strong>
                      <small>{summary.lowConfidencePredictions} seçim</small>
                    </div>
                    <b className={styles.poor}>
                      {formatPercentage(summary.lowConfidenceAccuracy)}
                    </b>
                    <div className={styles.confidenceBar}><span style={{ width: `${summary.lowConfidenceAccuracy}%` }} /></div>
                  </div>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.bucketPanel}`}>
                <div className={styles.compactPanelHeader}>
                  <div>
                    <div className={styles.panelTitle}>OLASILIK KALİBRASYONU</div>
                    <small>Tahmin edilen oran ile gerçek başarı farkı</small>
                  </div>
                  <span>FARK 0&apos;A YAKIN OLMALI</span>
                </div>
                <div className={styles.bucketTable}>
                  <div className={`${styles.bucketRow} ${styles.bucketHead}`}>
                    <span>Aralık</span>
                    <span>Adet</span>
                    <span>Model</span>
                    <span>Gerçek</span>
                    <span>Fark</span>
                  </div>
                  {summary.probabilityBuckets.map((bucket) => (
                    <div className={styles.bucketRow} key={bucket.label}>
                      <strong>{bucket.label}</strong>
                      <span>{bucket.settledPredictions}</span>
                      <span>{formatPercentage(bucket.averageValue)}</span>
                      <strong>
                        {bucket.settledPredictions > 0
                          ? formatPercentage(bucket.actualAccuracy)
                          : "—"}
                      </strong>
                      <span className={getCalibrationClass(bucket.calibrationGap)}>
                        {bucket.settledPredictions > 0
                          ? formatSignedPercentage(bucket.calibrationGap)
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <PredictionHistoryWorkspace
              predictions={predictions.map((prediction) => ({
                id: prediction.id,
                matchId: prediction.matchId,
                leagueName: prediction.leagueName,
                kickoffAt: prediction.kickoffAt.toISOString(),
                homeTeam: prediction.homeTeam,
                awayTeam: prediction.awayTeam,
                marketKey: prediction.marketKey,
                market: prediction.market,
                selection: prediction.selection,
                predictedProbability: prediction.predictedProbability,
                fairOdds: prediction.fairOdds,
                marketOdds: prediction.marketOdds,
                confidenceScore: prediction.confidenceScore,
                dataQualityScore: prediction.dataQualityScore,
                actualHomeScore: prediction.actualHomeScore,
                actualAwayScore: prediction.actualAwayScore,
                result: prediction.result,
                modelVersion: prediction.modelVersion,
                publishedAt: prediction.publishedAt.toISOString(),
              }))}
            />
          </>
        )}
      </main>
    </PageShell>
  );
}
