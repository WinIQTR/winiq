"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { MarketPerformanceType } from "@/lib/market-performance-archive";
import {
  buildPerformanceInsights,
  probabilityBand,
  summarizePerformance,
  type GroupPerformance,
  type SampleLevel,
} from "@/lib/market-performance-analytics";
import styles from "@/app/match-result-performance/match-result-performance.module.css";

type Settlement = "WON" | "LOST" | "VOID" | "DATA_MISSING";
type Tier = "STRONG" | "MEDIUM" | "WEAK";
type SelectionSide = "HOME" | "DRAW" | "AWAY" | "NEUTRAL";
type PublicationBand = "STRONG" | "MEDIUM" | "REVIEW" | "NOT_RECOMMENDED";
type ResultFilter = "ALL" | Settlement;
type TierFilter = "ALL" | Tier;
type SideFilter = "ALL" | SelectionSide;
type OddsFilter = "ALL" | "PASS" | "BELOW";
type ProbabilityRange =
  | "ALL" | "0_29" | "30_39" | "40_49" | "50_59"
  | "60_69" | "70_79" | "80_89" | "90_100";

export type SerializedMarketPerformanceRow = {
  id: string;
  marketNumber: number;
  marketTitle: string;
  matchId: number;
  kickoffAt: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  optionKey: string;
  probability: number;
  fairOdds: number;
  score: number;
  tier: Tier;
  confidenceScore: number;
  dataQualityScore: number;
  selectionSide: SelectionSide;
  publicationBand: PublicationBand;
  minimumFairOddsPassed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  result: Settlement;
};

function percentage(value: number | null): string {
  return value === null ? "—" : `%${value.toFixed(1)}`;
}

function signedPercentage(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} puan`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function settlementLabel(value: Settlement): string {
  if (value === "WON") return "KAZANDI";
  if (value === "LOST") return "KAYBETTİ";
  if (value === "VOID") return "İADE";
  return "VERİ BEKLENİYOR";
}

function tierLabel(value: Tier): string {
  if (value === "STRONG") return "GÜÇLÜ";
  if (value === "MEDIUM") return "ORTA";
  return "ZAYIF";
}

function sideLabel(value: SelectionSide): string {
  if (value === "HOME") return "Ev sahibi";
  if (value === "DRAW") return "Beraberlik";
  if (value === "AWAY") return "Deplasman";
  return "Tarafsız / Toplam";
}

function sampleLabel(value: SampleLevel): string {
  if (value === "SUFFICIENT") return "YETERLİ";
  if (value === "DEVELOPING") return "GELİŞİYOR";
  if (value === "INSUFFICIENT") return "YETERSİZ";
  return "VERİ YOK";
}

function sampleDescription(value: SampleLevel): string {
  if (value === "SUFFICIENT") return "30+ sonuçlanan seçim";
  if (value === "DEVELOPING") return "10–29 sonuç; dikkatli yorumlayın";
  if (value === "INSUFFICIENT") return "1–9 sonuç; karar için erken";
  return "Henüz sonuçlanan seçim yok";
}

function matchesProbabilityRange(value: number, range: ProbabilityRange): boolean {
  if (range === "ALL") return true;
  if (range === "0_29") return value < 30;
  if (range === "30_39") return value >= 30 && value < 40;
  if (range === "40_49") return value >= 40 && value < 50;
  if (range === "50_59") return value >= 50 && value < 60;
  if (range === "60_69") return value >= 60 && value < 70;
  if (range === "70_79") return value >= 70 && value < 80;
  if (range === "80_89") return value >= 80 && value < 90;
  return value >= 90;
}

function CompactPerformanceTable({
  title, eyebrow, rows, emptyText = "Bu bölüm için yeterli kayıt yok.",
}: { title: string; eyebrow: string; rows: GroupPerformance[]; emptyText?: string }) {
  return (
    <article className={styles.panel}>
      <header className={styles.panelHeading}>
        <div><span>{eyebrow}</span><h2>{title}</h2></div><small>Beklenen ↔ Gerçek</small>
      </header>
      {rows.length === 0 ? <p className={styles.mutedText}>{emptyText}</p> : (
        <div className={styles.compactMetricList}>
          <div className={`${styles.compactMetricRow} ${styles.compactMetricHead}`}>
            <span>Grup</span><span>Örnek</span><span>Beklenen</span><span>Gerçek</span><span>Fark</span>
          </div>
          {rows.map((row) => (
            <div className={styles.compactMetricRow} key={row.key}>
              <strong title={row.label}>{row.label}</strong>
              <span>{row.settled} <small className={styles[`sample${row.sampleLevel}`]}>{sampleLabel(row.sampleLevel)}</small></span>
              <span>{percentage(row.expectedAccuracy)}</span>
              <strong>{percentage(row.actualAccuracy)}</strong>
              <span className={row.calibrationGap !== null && row.calibrationGap < -5 ? styles.lostText : styles.wonText}>
                {signedPercentage(row.calibrationGap)}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function InsightList({ title, children }: { title: string; children: ReactNode }) {
  return <article className={styles.insightCard}><span>{title}</span>{children}</article>;
}

export function MarketPerformanceWorkspace({ marketTypes, rows, seasonLabel }: {
  marketTypes: MarketPerformanceType[];
  rows: SerializedMarketPerformanceRow[];
  seasonLabel: string;
}) {
  const [activeMarket, setActiveMarket] = useState(1);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [oddsFilter, setOddsFilter] = useState<OddsFilter>("ALL");
  const [probabilityRange, setProbabilityRange] = useState<ProbabilityRange>("ALL");
  const [visibleCount, setVisibleCount] = useState(50);

  const activeType = marketTypes.find((market) => market.number === activeMarket) ?? marketTypes[0]!;
  const marketRows = useMemo(() => rows.filter((row) => row.marketNumber === activeMarket), [activeMarket, rows]);
  const summary = useMemo(() => summarizePerformance(marketRows), [marketRows]);
  const insights = useMemo(() => buildPerformanceInsights(marketRows), [marketRows]);
  const accuracy = summary.actualAccuracy ?? 0;

  const tierCards = (["STRONG", "MEDIUM", "WEAK"] as const).map((tier) => ({
    tier, ...summarizePerformance(marketRows.filter((row) => row.tier === tier)),
  }));

  const probabilityBands = Array.from({ length: 10 }, (_, index) => {
    const key = String(index * 10);
    return insights.probability.find((row) => row.key === key) ?? {
      key, label: probabilityBand(index * 10).label, ...summarizePerformance([]),
    };
  });

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return marketRows.filter((row) => {
      const matchesQuery = !normalized || `${row.homeTeam} ${row.awayTeam} ${row.leagueName} ${row.selection}`
        .toLocaleLowerCase("tr-TR").includes(normalized);
      return matchesQuery &&
        (resultFilter === "ALL" || row.result === resultFilter) &&
        (tierFilter === "ALL" || row.tier === tierFilter) &&
        (sideFilter === "ALL" || row.selectionSide === sideFilter) &&
        (oddsFilter === "ALL" || (oddsFilter === "PASS" ? row.minimumFairOddsPassed : !row.minimumFairOddsPassed)) &&
        matchesProbabilityRange(row.probability, probabilityRange);
    });
  }, [marketRows, oddsFilter, probabilityRange, query, resultFilter, sideFilter, tierFilter]);

  function resetFilters(): void {
    setQuery(""); setResultFilter("ALL"); setTierFilter("ALL");
    setSideFilter("ALL"); setOddsFilter("ALL"); setProbabilityRange("ALL"); setVisibleCount(50);
  }

  function changeMarket(value: number): void { setActiveMarket(value); resetFilters(); }

  return (
    <>
      <section className={styles.marketSelectorPanel}>
        <div>
          <span>27+ BAHİS TÜRÜ • TEK PERFORMANS MERKEZİ</span>
          <strong>Bahis türünü seçin, beklenen ve gerçek sonucu karşılaştırın</strong>
          <small>Lig, seçim tarafı, veri kalitesi ve yüzde aralıkları aynı ekranda incelenir.</small>
        </div>
        <label className={styles.primaryMarketSelect}>
          <span>AKTİF BAHİS TÜRÜ</span>
          <select value={activeMarket} onChange={(event) => changeMarket(Number(event.target.value))}>
            {marketTypes.map((market) => {
              const count = rows.filter((row) => row.marketNumber === market.number).length;
              return <option key={market.number} value={market.number}>
                {String(market.number).padStart(2, "0")} · {market.title} ({count})
              </option>;
            })}
          </select>
        </label>
      </section>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>15 AĞUSTOS 2026 → BUGÜN • {seasonLabel}</p>
          <h1>{activeType.title} Performansı</h1>
          <p className={styles.subtitle}>
            Maç öncesi model olasılığı ile gerçek sonuç yan yana gösterilir.
            İade ve veri bekleyen kayıtlar başarı hesabına katılmaz; düşük örneklem açıkça uyarılır.
          </p>
          <div className={styles.heroTags}>
            <span>PAZAR {String(activeType.number).padStart(2, "0")} / 27</span>
            <span>MODEL AĞIRLIKLARI KİLİTLİ</span><span>ADİL ORAN EŞİĞİ 1.10</span>
          </div>
        </div>
        <div className={styles.heroResult}>
          <div className={styles.accuracyRing} style={{ "--accuracy": `${accuracy * 3.6}deg` } as CSSProperties}>
            <div><strong>{percentage(summary.actualAccuracy)}</strong><span>GERÇEK</span></div>
          </div>
          <div><span>KALİBRASYON ÖZETİ</span><strong>Beklenen {percentage(summary.expectedAccuracy)}</strong>
            <small>Fark: {signedPercentage(summary.calibrationGap)}</small></div>
        </div>
      </header>

      <section className={`${styles.sampleNotice} ${styles[`sampleNotice${summary.sampleLevel}`]}`}>
        <strong>{sampleLabel(summary.sampleLevel)} ÖRNEKLEM</strong>
        <span>{sampleDescription(summary.sampleLevel)}. Sonuçlanan: {summary.settled}</span>
      </section>

      <section className={styles.kpiGridSix}>
        <article><span>SONUÇLANAN</span><strong>{summary.settled}</strong><small>{summary.total} toplam kayıt</small></article>
        <article><span>BEKLENEN BAŞARI</span><strong>{percentage(summary.expectedAccuracy)}</strong><small>Ortalama model olasılığı</small></article>
        <article className={styles.wonCard}><span>GERÇEK BAŞARI</span><strong>{percentage(summary.actualAccuracy)}</strong><small>{summary.won} kazandı</small></article>
        <article className={styles.lostCard}><span>KALİBRASYON FARKI</span><strong>{signedPercentage(summary.calibrationGap)}</strong><small>Gerçek − beklenen</small></article>
        <article><span>KAYBETTİ / İADE</span><strong>{summary.lost} / {summary.voided}</strong><small>{summary.missing} veri bekliyor</small></article>
        <article><span>ADİL ORAN ≥1.10</span><strong>{insights.fairOddsPassed}</strong><small>{insights.fairOddsBelow} eşik altında</small></article>
      </section>

      <section className={styles.analysisGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeading}><div><span>PUAN SEVİYESİNE GÖRE</span><h2>Güçlü / Orta / Zayıf</h2></div><small>Gerçek başarı</small></header>
          <div className={styles.outcomeGrid}>
            {tierCards.map((card) => <article key={card.tier}>
              <span>{tierLabel(card.tier)} · {card.settled} sonuç</span><strong>{percentage(card.actualAccuracy)}</strong>
              <small>Beklenen {percentage(card.expectedAccuracy)} · Fark {signedPercentage(card.calibrationGap)}</small>
              <div><span style={{ width: `${card.actualAccuracy ?? 0}%` }} /></div>
            </article>)}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeading}><div><span>MODEL YÜZDESİNE GÖRE</span><h2>Hangi Olasılıklar Kazandı?</h2></div><small>Beklenen ↔ Gerçek</small></header>
          <div className={styles.bucketList}>
            <div className={`${styles.calibrationBucketRow} ${styles.bucketHead}`}>
              <span>Yüzde</span><span>Örnek</span><span>Kazandı</span><span>Kaybetti</span><span>Beklenen</span><span>Gerçek</span><span>Fark</span>
            </div>
            {probabilityBands.map((bucket) => <div className={styles.calibrationBucketRow} key={bucket.key}>
              <strong>{bucket.label}</strong><span>{bucket.settled}</span><span className={styles.wonText}>{bucket.won}</span>
              <span className={styles.lostText}>{bucket.lost}</span><span>{percentage(bucket.expectedAccuracy)}</span>
              <strong>{percentage(bucket.actualAccuracy)}</strong><span>{signedPercentage(bucket.calibrationGap)}</span>
            </div>)}
          </div>
        </article>
      </section>

      <section className={styles.deepAnalysisGrid}>
        <CompactPerformanceTable eyebrow="LİG BAZINDA" title="Lig Performansı" rows={insights.leagues} />
        <CompactPerformanceTable eyebrow="SEÇİM BAZINDA" title={activeMarket === 1 ? "MS 1 / MS 0 / MS 2" : "En Çok Kullanılan Seçimler"} rows={insights.selections.slice(0, 12)} />
        <CompactPerformanceTable eyebrow="EV / BERABERLİK / DEPLASMAN" title="Seçim Tarafı Performansı" rows={insights.sides} />
        <CompactPerformanceTable eyebrow="VERİ KALİTESİ" title="Kalite Seviyesine Göre Başarı" rows={insights.quality} />
      </section>

      <section className={styles.insightGrid}>
        <InsightList title="EN ÇOK KAYBETTİREN LİGLER">
          {insights.worstLeagues.length ? insights.worstLeagues.map((row) => <div key={row.key}><strong>{row.label}</strong><span>{row.lost} kayıp · {percentage(row.actualAccuracy)}</span></div>) : <small>Yeterli sonuç yok</small>}
        </InsightList>
        <InsightList title="EN ÇOK KAYBETTİREN SEÇİMLER">
          {insights.worstSelections.length ? insights.worstSelections.map((row) => <div key={row.key}><strong>{row.label}</strong><span>{row.lost} kayıp · {percentage(row.actualAccuracy)}</span></div>) : <small>Yeterli sonuç yok</small>}
        </InsightList>
        <InsightList title="EN BAŞARILI YÜZDE ARALIKLARI">
          {insights.bestProbabilityBands.length ? insights.bestProbabilityBands.map((row) => <div key={row.key}><strong>{row.label}</strong><span>{percentage(row.actualAccuracy)} · {row.settled} sonuç</span></div>) : <small>En az 10 sonuçlanan seçim gerekli</small>}
        </InsightList>
      </section>

      <section className={styles.historyPanel}>
        <header className={styles.panelHeading}>
          <div><span>DOĞRULANMIŞ PAZAR ARŞİVİ</span><h2>{activeType.title} Maç Listesi</h2>
            <p>Adil oran model olasılığından hesaplanır; bookmaker oranı değildir.</p></div>
          <strong>{filteredRows.length} kayıt</strong>
        </header>

        <div className={styles.marketFilterBarSix}>
          <label className={styles.searchControl}><span>TAKIM, LİG VEYA SEÇİM ARA</span>
            <input value={query} placeholder="Takım, lig veya seçim yazın..." onChange={(event) => { setQuery(event.target.value); setVisibleCount(50); }} />
          </label>
          <label><span>SONUÇ</span><select value={resultFilter} onChange={(event) => { setResultFilter(event.target.value as ResultFilter); setVisibleCount(50); }}>
            <option value="ALL">Tüm sonuçlar</option><option value="WON">Kazandı</option><option value="LOST">Kaybetti</option><option value="VOID">İade</option><option value="DATA_MISSING">Veri bekleniyor</option>
          </select></label>
          <label><span>PUAN SEVİYESİ</span><select value={tierFilter} onChange={(event) => { setTierFilter(event.target.value as TierFilter); setVisibleCount(50); }}>
            <option value="ALL">Tüm seviyeler</option><option value="STRONG">Güçlü</option><option value="MEDIUM">Orta</option><option value="WEAK">Zayıf</option>
          </select></label>
          <label><span>SEÇİM TARAFI</span><select value={sideFilter} onChange={(event) => { setSideFilter(event.target.value as SideFilter); setVisibleCount(50); }}>
            <option value="ALL">Tüm taraflar</option><option value="HOME">Ev sahibi</option><option value="DRAW">Beraberlik</option><option value="AWAY">Deplasman</option><option value="NEUTRAL">Tarafsız / Toplam</option>
          </select></label>
          <label><span>MODEL OLASILIĞI</span><select value={probabilityRange} onChange={(event) => { setProbabilityRange(event.target.value as ProbabilityRange); setVisibleCount(50); }}>
            <option value="ALL">%0–100 · Tümü</option><option value="0_29">%0–29,9</option><option value="30_39">%30–39,9</option><option value="40_49">%40–49,9</option><option value="50_59">%50–59,9</option><option value="60_69">%60–69,9</option><option value="70_79">%70–79,9</option><option value="80_89">%80–89,9</option><option value="90_100">%90–100</option>
          </select></label>
          <label><span>ADİL ORAN 1.10</span><select value={oddsFilter} onChange={(event) => { setOddsFilter(event.target.value as OddsFilter); setVisibleCount(50); }}>
            <option value="ALL">Tümü</option><option value="PASS">1.10 ve üzeri</option><option value="BELOW">1.10 altı</option>
          </select></label>
        </div>

        <button className={styles.clearFilters} type="button" onClick={resetFilters}>Filtreleri temizle</button>

        {filteredRows.length === 0 ? <div className={styles.emptyList}>Bu filtreler için arşiv kaydı yok.</div> : (
          <div className={styles.tableWrap}>
            <div className={`${styles.marketResultRowV941} ${styles.tableHead}`}>
              <span>Tarih / Lig</span><span>Maç</span><span>En Güçlü Seçim</span><span>Taraf</span><span>Model</span><span>Veri</span><span>Adil Oran</span><span>Skor</span><span>Sonuç</span>
            </div>
            {filteredRows.slice(0, visibleCount).map((row) => <article className={styles.marketResultRowV941} key={row.id}>
              <div className={styles.dateCell}><strong>{formatDate(row.kickoffAt)}</strong><span>{row.leagueName}</span></div>
              <div className={styles.matchCell}><strong>{row.homeTeam}</strong><span>–</span><strong>{row.awayTeam}</strong></div>
              <strong className={styles.selectionCell}>{row.selection}</strong><span>{sideLabel(row.selectionSide)}</span>
              <strong className={styles.probabilityCell}>%{row.probability.toFixed(1)}</strong><span>{row.dataQualityScore.toFixed(0)}/100</span>
              <span className={row.minimumFairOddsPassed ? styles.wonText : styles.lostText}>{row.fairOdds.toFixed(2)} {row.minimumFairOddsPassed ? "✓" : "<"}</span>
              <strong className={styles.scoreCell}>{row.homeScore === null || row.awayScore === null ? "—" : `${row.homeScore} – ${row.awayScore}`}</strong>
              <span className={`${styles.resultBadge} ${styles[`result${row.result}`]}`}>{settlementLabel(row.result)}</span>
            </article>)}
          </div>
        )}

        {visibleCount < filteredRows.length ? <button className={styles.loadMore} type="button" onClick={() => setVisibleCount((current) => current + 50)}>50 kayıt daha göster</button> : null}
      </section>
    </>
  );
}
