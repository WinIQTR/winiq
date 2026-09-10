"use client";

import { useMemo, useState } from "react";
import {
  hasMembershipPermission,
  type MembershipPlanName,
} from "@/lib/membership-access";
import type { CouponBand, CouponWindow } from "@/lib/smart-coupon-engine";
import styles from "./smart-coupon-workspace.module.css";

type SerializedLeg = {
  valueBetHistoryId: number | null;
  matchId: number;
  kickoffAt: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketKey: string;
  market: string;
  selection: string;
  bookmakerName: string;
  odds: number;
  modelProbability: number;
  marketProbability: number;
  marketEdge: number;
  expectedValue: number;
  valueScore: number;
  recommendedStakePercentage: number;
  bookmakerCount: number;
  sourceUpdatedAt: string;
  historicalHitRate: number | null;
  historicalSamples: number;
  warnings: string[];
};

export type SerializedCoupon = {
  id: string;
  window: CouponWindow;
  band: CouponBand;
  title: string;
  explanation: string;
  riskNote: string;
  totalOdds: number;
  combinedModelProbability: number;
  averageModelProbability: number;
  averageMarketEdge: number;
  averageExpectedValue: number;
  minimumBookmakerCount: number;
  oldestSourceUpdatedAt: string;
  legs: SerializedLeg[];
  isFallback?: boolean;
};

type AccessMode = "ADMIN" | MembershipPlanName;

function formatKickoff(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function mayOpen(access: AccessMode, window: CouponWindow, band: CouponBand): boolean {
  if (access === "ADMIN") return true;
  const windowAllowed = hasMembershipPermission(
    access,
    window === "DAILY" ? "DAILY_COUPONS" : "WEEKLY_COUPONS",
  );
  if (!windowAllowed) return false;
  if (band === "BALANCED") {
    return hasMembershipPermission(access, "BALANCED_COUPONS");
  }
  if (band === "SURPRISE") {
    return hasMembershipPermission(access, "SURPRISE_COUPONS");
  }
  return true;
}

function accessMessage(access: AccessMode, window: CouponWindow, band: CouponBand): string {
  if (access === "BASIC") {
    return window === "WEEKLY"
      ? "Haftalık kuponlar Analiz paketinden itibaren açılır."
      : "5–10 ve Sürpriz kuponları daha yüksek üyelik paketlerinde açılır.";
  }
  if (access === "ANALYSIS" && band === "SURPRISE") {
    return "Sürpriz kuponlar ve profesyonel risk verileri Profesyonel pakette açılır.";
  }
  return "Bu kupon üyelik kapsamınızda bulunmuyor.";
}

export function SmartCouponWorkspace({
  coupons,
  fallbackCoupons,
  missing,
  generatedAt,
  eligibleCandidates,
  advisoryCandidates,
  rejectedCandidates,
  rejectionBreakdown,
  access,
}: {
  coupons: SerializedCoupon[];
  fallbackCoupons: SerializedCoupon[];
  missing: Array<{ window: CouponWindow; band: CouponBand; reason: string }>;
  generatedAt: string;
  eligibleCandidates: number;
  advisoryCandidates: number;
  rejectedCandidates: number;
  rejectionBreakdown: {
    startedOrFinished: number;
    outsideSevenDays: number;
    invalidOdds: number;
    insufficientBookmakers: number;
    staleOdds: number;
    invalidProbability: number;
  };
  access: AccessMode;
}) {
  const [window, setWindow] = useState<CouponWindow>("DAILY");
  const [band, setBand] = useState<CouponBand>("SAFE");
  const visible = useMemo(
    () => {
      const official = coupons.filter((coupon) => coupon.window === window && coupon.band === band);
      return official.length > 0
        ? official
        : fallbackCoupons.filter((coupon) => coupon.window === window && coupon.band === band);
    },
    [band, coupons, fallbackCoupons, window],
  );
  const locked = !mayOpen(access, window, band);
  const missingReason = missing.find((item) => item.window === window && item.band === band)?.reason;

  return (
    <div className={styles.workspace}>
      <header className={styles.hero}>
        <div>
          <p>AKILLI KUPON MERKEZİ</p>
          <h1>Az Maç, Güçlü Seçim</h1>
          <span>
            Aynı maçtan yalnız bir seçim kullanılır. Gerçek bookmaker oranı,
            model olasılığı, piyasa farkı ve veri kalitesi birlikte değerlendirilir.
          </span>
        </div>
        <div className={styles.heroStats}>
          <article><span>Uygun seçim</span><strong>{eligibleCandidates}</strong></article>
          <article><span>Zayıf aday</span><strong>{advisoryCandidates}</strong></article>
          <article><span>Tamamen elenen</span><strong>{rejectedCandidates}</strong></article>
          <small>Son hesaplama: {formatGeneratedAt(generatedAt)}</small>
        </div>
      </header>

      <section className={styles.disclaimer}>
        <strong>Önemli:</strong> Kuponlar olasılık analizidir, kazanç garantisi değildir.
        Birleşik olasılık yaklaşık değerdir ve kupondaki bütün seçimlerin gerçekleşmesi gerekir.
      </section>

      <details className={styles.diagnostics} open={eligibleCandidates === 0}>
        <summary>Neden seçimler elendi?</summary>
        <div>
          <span>Eski oran <strong>{rejectionBreakdown.staleOdds}</strong></span>
          <span>Bookmaker yetersiz <strong>{rejectionBreakdown.insufficientBookmakers}</strong></span>
          <span>Başlamış / bitmiş <strong>{rejectionBreakdown.startedOrFinished}</strong></span>
          <span>7 gün dışında <strong>{rejectionBreakdown.outsideSevenDays}</strong></span>
          <span>Oran geçersiz <strong>{rejectionBreakdown.invalidOdds}</strong></span>
          <span>Model verisi yetersiz <strong>{rejectionBreakdown.invalidProbability}</strong></span>
        </div>
        <p>Bir maç birden fazla nedenle elenebilir. Eski oranlı seçimler yalnız kırmızı “Zayıf / Önerilmez” kuponlarda kullanılabilir.</p>
      </details>

      <section className={styles.filters}>
        <div>
          <span>SÜRE</span>
          <button className={window === "DAILY" ? styles.active : ""} onClick={() => setWindow("DAILY")} type="button">Bugün</button>
          <button className={window === "WEEKLY" ? styles.active : ""} onClick={() => setWindow("WEEKLY")} type="button">1 Hafta</button>
        </div>
        <div>
          <span>KUPON TÜRÜ</span>
          <button className={band === "SAFE" ? styles.activeSafe : ""} onClick={() => setBand("SAFE")} type="button">2–5 · Yüksek Güven</button>
          <button className={band === "BALANCED" ? styles.activeBalanced : ""} onClick={() => setBand("BALANCED")} type="button">5–10 · Dengeli</button>
          <button className={band === "SURPRISE" ? styles.activeSurprise : ""} onClick={() => setBand("SURPRISE")} type="button">10–30 · Sürpriz</button>
          <button className={band === "WEAK" ? styles.activeWeak : ""} onClick={() => setBand("WEAK")} type="button">2–10 · Zayıf / Önerilmez</button>
        </div>
      </section>

      {locked ? (
        <section className={styles.locked}>
          <span>KİLİTLİ KUPON</span><h2>Bu görünüm paketinizde kapalı</h2>
          <p>{accessMessage(access, window, band)}</p>
          {access !== "ADMIN" ? <a href="/member/plans">Paketleri karşılaştır</a> : null}
        </section>
      ) : visible.length === 0 ? (
        <section className={styles.empty}>
          <span>GÜVENLİ BOŞ DURUM</span><h2>Bu filtrede yayımlanabilir kupon yok</h2>
          <p>{missingReason ?? "Kalite ve oran eşiklerini geçen yeterli seçim bulunamadı."}</p>
          <small>{band === "WEAK" ? "Son 7 günlük kayıtlar da uygun değilse sistem tahmin uydurmaz." : "Sistem güçlü kupon hedefini yakalamak için güvenlik şartlarını gevşetmez."}</small>
        </section>
      ) : (
        <section className={styles.couponList}>
          {visible.map((coupon, index) => (
            <article className={`${styles.coupon} ${styles[`coupon${coupon.band}`]}`} key={coupon.id}>
              <header>
                <div><span>{coupon.window === "DAILY" ? "BUGÜN / EN YAKIN GÜN" : "7 GÜN"} · KUPON {index + 1}</span><h2>{coupon.title}</h2>{coupon.isFallback ? <b className={styles.fallbackBadge}>ALTERNATİF ÖNERİ · ORANI KONTROL ET</b> : coupon.band === "WEAK" ? <b className={styles.weakBadge}>RESMÎ ÖNERİ DEĞİL</b> : null}</div>
                <div className={styles.totalOdds}><span>Toplam oran</span><strong>{coupon.totalOdds.toFixed(2)}</strong></div>
              </header>

              <div className={styles.summaryGrid}>
                <div><span>Maç</span><strong>{coupon.legs.length}</strong></div>
                <div><span>Birleşik model</span><strong>%{coupon.combinedModelProbability.toFixed(1)}</strong></div>
                <div><span>Ort. olasılık</span><strong>%{coupon.averageModelProbability.toFixed(1)}</strong></div>
                {access === "ADMIN" || access === "PROFESSIONAL" ? <>
                  <div><span>Ort. piyasa farkı</span><strong>+{coupon.averageMarketEdge.toFixed(1)}</strong></div>
                  <div><span>Ort. EV</span><strong>%{coupon.averageExpectedValue.toFixed(1)}</strong></div>
                </> : null}
              </div>

              <div className={styles.explanation}><strong>Neden bu kupon?</strong><p>{coupon.explanation}</p><small>{coupon.riskNote}</small></div>

              <div className={styles.legs}>
                {coupon.legs.map((leg, legIndex) => (
                  <article
                    className={
                      access === "BASIC"
                        ? styles.legBasic
                        : access === "ANALYSIS"
                          ? styles.legAnalysis
                          : styles.legProfessional
                    }
                    key={`${coupon.id}-${leg.matchId}`}
                  >
                    <span className={styles.legNumber}>{String(legIndex + 1).padStart(2, "0")}</span>
                    <div className={styles.match}><small>{leg.leagueName} · {formatKickoff(leg.kickoffAt)}</small><strong>{leg.homeTeam} – {leg.awayTeam}</strong></div>
                    <div className={styles.pick}><small>{leg.market}</small><strong>{leg.selection}</strong>{coupon.band === "WEAK" && leg.warnings.length > 0 ? <span className={styles.legWarnings}>{leg.warnings.map((warning) => <i key={warning}>{warning}</i>)}</span> : null}</div>
                    {access !== "BASIC" ? <div className={styles.model}><small>Model / Geçmiş</small><strong>%{leg.modelProbability.toFixed(1)} · {leg.historicalHitRate === null ? "—" : `%${leg.historicalHitRate.toFixed(1)}`}</strong><span>{leg.historicalSamples} geçmiş sonuç</span></div> : null}
                    {access === "ADMIN" || access === "PROFESSIONAL" ? <div className={styles.pro}><small>EV / Değer</small><strong>%{leg.expectedValue.toFixed(1)} · {leg.valueScore.toFixed(0)}/100</strong><span>{leg.bookmakerName} · {leg.bookmakerCount} kaynak</span></div> : null}
                    <div className={styles.odds}><small>Oran</small><strong>{leg.odds.toFixed(2)}</strong></div>
                  </article>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
