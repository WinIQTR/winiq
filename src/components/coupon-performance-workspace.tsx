"use client";

import { useMemo, useState } from "react";
import type { CouponPerformanceReport, CouponSettlement } from "@/lib/smart-coupon-performance";
import styles from "./coupon-performance-workspace.module.css";

export type SerializedCouponPerformanceRow = {
  id: number;
  window: string;
  band: string;
  title: string;
  totalOdds: number;
  combinedModelProbability: number;
  result: CouponSettlement;
  profitUnits: number | null;
  publishedAt: string;
  settledAt: string | null;
  legs: Array<{
    id: number;
    kickoffAt: string;
    leagueName: string;
    homeTeam: string;
    awayTeam: string;
    market: string;
    selection: string;
    odds: number;
    modelProbability: number;
    result: CouponSettlement;
    actualHomeScore: number | null;
    actualAwayScore: number | null;
  }>;
};

const BAND_LABEL: Record<string, string> = {
  SAFE: "Yüksek Güven",
  BALANCED: "Dengeli",
  SURPRISE: "Sürpriz",
  WEAK: "Zayıf / Önerilmez",
};
const RESULT_LABEL: Record<CouponSettlement, string> = {
  PENDING: "Bekliyor",
  WON: "Kazandı",
  LOST: "Kaybetti",
  VOID: "İade",
};

function date(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function percent(value: number | null): string {
  return value === null ? "—" : `%${value.toFixed(1)}`;
}

export function CouponPerformanceWorkspace({
  rows,
  report,
}: {
  rows: SerializedCouponPerformanceRow[];
  report: CouponPerformanceReport;
}) {
  const [band, setBand] = useState("ALL");
  const [window, setWindow] = useState("ALL");
  const [result, setResult] = useState("ALL");
  const visible = useMemo(() => rows.filter((row) =>
    (band === "ALL" || row.band === band) &&
    (window === "ALL" || row.window === window) &&
    (result === "ALL" || row.result === result),
  ), [band, result, rows, window]);

  return <div className={styles.workspace}>
    <header className={styles.hero}>
      <div><p>KUPON SONUÇ MERKEZİ</p><h1>Kupon Performansı</h1><span>Yayınlanan kuponların değişmeyen seçimleri, maç sonuçları ve gerçek başarı oranı.</span></div>
      <div className={styles.winRate}><strong>{percent(report.overall.winRate)}</strong><span>GERÇEK BAŞARI</span><small>Bekleyen ve iadeler hariç</small></div>
    </header>

    <section className={styles.metrics}>
      <article><span>Toplam kupon</span><strong>{report.overall.total}</strong></article>
      <article><span>Sonuçlanan</span><strong>{report.overall.settled}</strong></article>
      <article className={styles.won}><span>Kazandı</span><strong>{report.overall.won}</strong></article>
      <article className={styles.lost}><span>Kaybetti</span><strong>{report.overall.lost}</strong></article>
      <article><span>Bekliyor / İade</span><strong>{report.overall.pending} / {report.overall.voided}</strong></article>
      <article><span>Sabit birim ROI</span><strong>{percent(report.overall.roi)}</strong></article>
    </section>

    <section className={styles.bandSummary}>
      {report.byBand.map((item) => <article className={styles[`band${item.key}`]} key={item.key}>
        <span>{BAND_LABEL[item.key] ?? item.key}</span><strong>{percent(item.summary.winRate)}</strong><small>{item.summary.won} kazandı · {item.summary.lost} kaybetti</small>
      </article>)}
    </section>

    <section className={styles.filters}>
      <label>Kupon türü<select value={band} onChange={(event) => setBand(event.target.value)}><option value="ALL">Tümü</option><option value="SAFE">Yüksek Güven</option><option value="BALANCED">Dengeli</option><option value="SURPRISE">Sürpriz</option><option value="WEAK">Zayıf / Önerilmez</option></select></label>
      <label>Süre<select value={window} onChange={(event) => setWindow(event.target.value)}><option value="ALL">Tümü</option><option value="DAILY">Günlük</option><option value="WEEKLY">Haftalık</option></select></label>
      <label>Sonuç<select value={result} onChange={(event) => setResult(event.target.value)}><option value="ALL">Tümü</option><option value="WON">Kazandı</option><option value="LOST">Kaybetti</option><option value="PENDING">Bekliyor</option><option value="VOID">İade</option></select></label>
      <div className={styles.visibleCount}><strong>{visible.length}</strong><span>kupon gösteriliyor</span></div>
    </section>

    {rows.length === 0 ? <section className={styles.empty}><strong>Henüz kayıtlı kupon yok</strong><p>Takip V9.5.2 kurulduktan sonraki ilk `pnpm run value-bets` veya günlük yenileme çalışmasıyla başlar. Geçmişte kaydedilmemiş kuponlar sonradan uydurulmaz.</p></section> :
      visible.length === 0 ? <section className={styles.empty}><strong>Bu filtrede kupon bulunamadı</strong><p>Başka bir kupon türü, süre veya sonuç seçin.</p></section> :
      <section className={styles.list}>{visible.map((coupon) => <details className={`${styles.coupon} ${styles[`result${coupon.result}`]} ${coupon.band === "WEAK" ? styles.weak : ""}`} key={coupon.id}>
        <summary>
          <div className={styles.date}><small>Yayın</small><strong>{date(coupon.publishedAt)}</strong></div>
          <div><small>Tür</small><strong>{coupon.window === "DAILY" ? "Günlük" : "Haftalık"} · {BAND_LABEL[coupon.band] ?? coupon.band}</strong></div>
          <div><small>Maç / Oran</small><strong>{coupon.legs.length} maç · {coupon.totalOdds.toFixed(2)}</strong></div>
          <div><small>Birleşik model</small><strong>%{coupon.combinedModelProbability.toFixed(1)}</strong></div>
          <span className={styles.status}>{RESULT_LABEL[coupon.result]}</span><b>Detay</b>
        </summary>
        <div className={styles.legs}>{coupon.legs.map((leg, index) => <article key={leg.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><small>{leg.leagueName} · {date(leg.kickoffAt)}</small><strong>{leg.homeTeam} – {leg.awayTeam}</strong></div>
          <div><small>{leg.market}</small><strong>{leg.selection} · {leg.odds.toFixed(2)}</strong></div>
          <div><small>Model</small><strong>%{leg.modelProbability.toFixed(1)}</strong></div>
          <div><small>Skor</small><strong>{leg.actualHomeScore === null || leg.actualAwayScore === null ? "—" : `${leg.actualHomeScore} – ${leg.actualAwayScore}`}</strong></div>
          <em className={styles[`leg${leg.result}`]}>{RESULT_LABEL[leg.result]}</em>
        </article>)}</div>
      </details>)}</section>}
  </div>;
}
