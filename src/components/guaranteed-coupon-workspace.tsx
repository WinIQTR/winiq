"use client";

import { useMemo, useState } from "react";
import type { SerializedCoupon } from "@/components/smart-coupon-workspace";
import styles from "./guaranteed-coupon-workspace.module.css";

type PerformanceLeg = { matchId:number; kickoffAt:Date|string; leagueName:string; homeTeam:string; awayTeam:string; market:string; marketKey:string; selection:string; odds:number; modelProbability:number; result:"PENDING"|"WON"|"LOST"|"VOID"; actualHomeScore:number|null; actualAwayScore:number|null };
type Props = { coupons: SerializedCoupon[]; performanceLegs: PerformanceLeg[]; generatedAt: string };
const date = (value: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(value));

export function GuaranteedCouponWorkspace({ coupons, performanceLegs, generatedAt }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [range, setRange] = useState<"DAY" | "WEEK">("DAY");
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const candidates = useMemo(() => {
    const map = new Map<string, SerializedCoupon["legs"][number] & { result?: string; historicalHitRate?: number | null }>();
    for (const coupon of coupons) for (const leg of coupon.legs) if (leg.modelProbability >= 60) {
      const kickoff = new Date(leg.kickoffAt);
      const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(kickoff);
      const start = new Date(`${anchor}T00:00:00`);
      const end = new Date(start); end.setDate(end.getDate() + (range === "WEEK" ? 7 : 1));
      const inRange = range === "DAY" ? dayKey === anchor : kickoff >= start && kickoff < end;
      if (!inRange) continue;
      const key = `${leg.matchId}|${leg.marketKey}|${leg.selection}`;
      const old = map.get(key);
      if (!old || leg.modelProbability > old.modelProbability) map.set(key, leg);
    }
    const stats = new Map<string, { won:number; settled:number }>();
    for (const leg of performanceLegs) if (leg.result === "WON" || leg.result === "LOST") { const key = `${leg.marketKey}|${leg.selection}`; const current = stats.get(key) ?? { won: 0, settled: 0 }; current.settled += 1; if (leg.result === "WON") current.won += 1; stats.set(key, current); }
    for (const leg of performanceLegs) if (leg.modelProbability >= 60) {
      const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(leg.kickoffAt));
      const start = new Date(`${anchor}T00:00:00`); const end = new Date(start); end.setDate(end.getDate() + (range === "WEEK" ? 7 : 1));
      if ((range === "DAY" ? dayKey !== anchor : new Date(leg.kickoffAt) < start || new Date(leg.kickoffAt) >= end)) continue;
      const key = `${leg.matchId}|${leg.marketKey}|${leg.selection}`; const s = stats.get(`${leg.marketKey}|${leg.selection}`); const normalized = { ...leg, kickoffAt: new Date(leg.kickoffAt).toISOString(), sourceUpdatedAt: new Date(leg.kickoffAt).toISOString(), valueBetHistoryId: null, bookmakerName: "Kupon Performansı", marketProbability: 0, marketEdge: 0, expectedValue: 0, valueScore: 0, recommendedStakePercentage: 0, bookmakerCount: 0, historicalHitRate: s?.settled ? s.won / s.settled * 100 : null, historicalSamples: s?.settled ?? 0, warnings: [] } as SerializedCoupon["legs"][number] & { result?: string; actualHomeScore?: number | null; actualAwayScore?: number | null; historicalHitRate?: number | null };
      const old = map.get(key); if (!old || leg.modelProbability > old.modelProbability) map.set(key, normalized);
    }
    const teamDates = new Set<string>();
    return [...map.entries()].map(([id, leg]) => ({ id, leg })).sort((a, b) => b.leg.modelProbability - a.leg.modelProbability).filter(({ leg }) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(leg.kickoffAt));
      const teams = [leg.homeTeam, leg.awayTeam].map((team) => team.trim().toLocaleLowerCase("tr-TR"));
      if (teams.some((team) => teamDates.has(`${day}|${team}`))) return false;
      teams.forEach((team) => teamDates.add(`${day}|${team}`));
      return true;
    });
  }, [anchor, coupons, performanceLegs, range]);
  const selectedLegs = candidates.filter((item) => selected.includes(item.id));
  const totalOdds = selectedLegs.reduce((total, item) => total * item.leg.odds, 1);
  const combined = selectedLegs.reduce((total, item) => total * item.leg.modelProbability / 100, 1) * 100;
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const shift = (days: number) => { const next = new Date(`${anchor}T00:00:00`); next.setDate(next.getDate() + days); const today = new Date(); today.setHours(0, 0, 0, 0); const latest = new Date(today); latest.setDate(latest.getDate() + 28); const bounded = next < today ? today : next > latest ? latest : next; setAnchor(bounded.toISOString().slice(0, 10)); setSelected([]); };
  const rangeLabel = range === "DAY"
    ? new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).format(new Date(`${anchor}T12:00:00`))
    : `${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(`${anchor}T12:00:00`))} – ${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(new Date(new Date(`${anchor}T12:00:00`).getTime() + 6 * 86400000))}`;
  return <main className={styles.page}>
    <header className={styles.hero}><div><p>WINIQ · GARANTİ KUPON</p><h1>Garanti Kupon</h1><span>Akıllı kuponlarda tekli maç modeli %60 ve üzeri olan seçimler.</span></div><div className={styles.heroStat}><b>{candidates.length}</b><small>uygun maç</small></div></header>
    <section className={styles.note}><b>Nasıl çalışır?</b><span>Akıllı Kupon Merkezi’ndeki önerilerden yalnızca tekli maç modeli %60+ olan bahisler alınır. Bu bir garanti değildir; model güven eşiğidir.</span><small>Son hesaplama: {date(generatedAt)}</small></section>
    <section className={styles.calendar}><div className={styles.rangeTabs}><button className={range === "DAY" ? styles.activeTab : ""} onClick={() => { setRange("DAY"); setSelected([]); }} type="button">Günlük</button><button className={range === "WEEK" ? styles.activeTab : ""} onClick={() => { setRange("WEEK"); setSelected([]); }} type="button">Haftalık</button></div><div className={styles.dateNav}><button onClick={() => shift(range === "WEEK" ? -7 : -1)} type="button">← Önceki</button><strong>{rangeLabel}</strong><button onClick={() => shift(range === "WEEK" ? 7 : 1)} type="button">Sonraki →</button></div><button className={styles.today} onClick={() => { setAnchor(new Date().toISOString().slice(0, 10)); setSelected([]); }} type="button">Bugün</button></section>
    <section className={styles.builder}><header><div><p>KUPON OLUŞTURUCU</p><h2>Seçimlerinden kupon oluştur</h2></div><button type="button" onClick={() => setSelected([])}>Temizle</button></header><div className={styles.builderStats}><span><b>{selectedLegs.length}</b> maç seçildi</span><span><b>{selectedLegs.length ? totalOdds.toFixed(2) : "—"}</b> toplam oran</span><span><b>{selectedLegs.length ? `%${combined.toFixed(1)}` : "—"}</b> birleşik model</span></div></section>
    <section className={styles.list}><header><div><p>GÜÇLÜ SEÇİMLER</p><h2>Tekli maç modeli %60–%100</h2></div><span>{candidates.length} maç · geçmiş kuponlar dahil</span></header>{candidates.length === 0 ? <div className={styles.empty}>Bu tarihte %60 üzeri kayıt bulunamadı.</div> : candidates.map(({ id, leg }, index) => { const result = (leg as typeof leg & { result?: string }).result; const score = (leg as typeof leg & { actualHomeScore?: number|null; actualAwayScore?: number|null }); return <article key={id} className={selected.includes(id) ? styles.selected : ""} onClick={() => toggle(id)}><div className={styles.check}>{selected.includes(id) ? "✓" : index + 1}</div><div className={styles.match}><small>{leg.leagueName} · {date(leg.kickoffAt)}</small><strong>{leg.homeTeam} <i>—</i> {leg.awayTeam}</strong><span>{leg.market} · {leg.selection}</span>{result && result !== "PENDING" ? <em className={result === "WON" ? styles.won : result === "LOST" ? styles.lost : styles.voided}>{result === "WON" ? "KAZANDI" : result === "LOST" ? "KAYBETTİ" : "İADE"}{score.actualHomeScore !== null && score.actualAwayScore !== null ? ` · Skor ${score.actualHomeScore}-${score.actualAwayScore}` : ""}</em> : null}</div><div className={styles.prob}><small>Tekli maç modeli</small><b>%{leg.modelProbability.toFixed(1)}</b>{leg.historicalHitRate !== null && leg.historicalHitRate !== undefined ? <em>Başarı %{leg.historicalHitRate.toFixed(1)} · {leg.historicalSamples} sonuç</em> : <em>Başarı verisi bekleniyor</em>}</div><div className={styles.odds}><small>Adil oran</small><b>{(100 / leg.modelProbability).toFixed(2)}</b></div></article>; })}</section>
    <footer>Seçimleri işaretleyerek kendi garanti kupon taslağını oluşturabilirsin. Yayın öncesi oran ve başlangıç saatini kontrol et.</footer>
  </main>;
}
