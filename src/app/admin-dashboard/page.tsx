import Image from "next/image";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import { requireAdmin } from "@/lib/auth-session";
import { selectStrongestDashboardPredictions } from "@/lib/daily-strongest-predictions";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel, type DashboardPrediction } from "@/lib/prediction-dashboard-shared";

import styles from "./admin-dashboard.module.css";

const TURKEY_TIME_ZONE = "Europe/Istanbul";

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: TURKEY_TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function translateSelection(value: string): string {
  return value.replace(/Home Team Goals/gi, "Ev sahibi takım golü").replace(/Away Team Goals/gi, "Deplasman takım golü").replace(/Total Goals/gi, "Toplam gol").replace(/Both Teams To Score/gi, "Karşılıklı gol").replace(/Under/gi, "Alt").replace(/Over/gi, "Üst").replace(/Home/gi, "Ev sahibi").replace(/Away/gi, "Deplasman").replace(/Draw/gi, "Beraberlik");
}

function fairOdds(prediction: DashboardPrediction): number {
  return prediction.predictedProbability > 0 ? 100 / prediction.predictedProbability : 0;
}

function outcomeLabel(prediction: DashboardPrediction): string {
  if (prediction.predictedOutcome === "HOME") return "1 (Ev sahibi)";
  if (prediction.predictedOutcome === "AWAY") return "2 (Deplasman)";
  return "X (Beraberlik)";
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return src ? <Image src={src} alt={`${name} logosu`} width={42} height={42} /> : <span className={styles.logoFallback}>{name.slice(0, 2).toUpperCase()}</span>;
}

function PredictionRow({ prediction }: { prediction: DashboardPrediction }) {
  const reasons = prediction.topPicks[0]?.reasons.slice(0, 2) ?? [];
  return <article className={styles.matchCard}>
    <div className={styles.matchMain}>
      <div className={styles.matchMeta}><strong>{prediction.leagueName}</strong><span>{formatTime(prediction.kickoffAt)}</span></div>
      <div className={styles.teams}>
        <div><TeamLogo src={prediction.homeTeamLogo} name={prediction.homeTeam}/><strong>{prediction.homeTeam}</strong></div><b>–</b>
        <div><TeamLogo src={prediction.awayTeamLogo} name={prediction.awayTeam}/><strong>{prediction.awayTeam}</strong></div>
      </div>
      <div className={styles.probabilities}>
        <span>1 <b>%{prediction.homeProbability.toFixed(0)}</b><i style={{width:`${prediction.homeProbability}%`}}/></span>
        <span>X <b>%{prediction.drawProbability.toFixed(0)}</b><i style={{width:`${prediction.drawProbability}%`}}/></span>
        <span>2 <b>%{prediction.awayProbability.toFixed(0)}</b><i style={{width:`${prediction.awayProbability}%`}}/></span>
      </div>
      <div className={styles.xg}><span>Beklenen gol</span><strong>{(prediction.expectedHomeGoals + prediction.expectedAwayGoals).toFixed(1)}</strong></div>
      <div className={styles.choice}><span className={styles.strongBadge}>GÜÇLÜ</span><small>En iyi seçim</small><strong>{translateSelection(getPredictionLabel(prediction))}</strong></div>
      <div className={styles.confidence}><span>Güven</span><strong>%{prediction.confidenceScore.toFixed(0)}</strong></div>
      <div className={styles.odds}><span>Adil oran</span><strong>{fairOdds(prediction).toFixed(2)}</strong></div>
    </div>
    <div className={styles.reasonBar}><strong>⌄ &nbsp; Neden bu tahmin?</strong>{reasons.length ? reasons.map((reason) => <span key={reason}>◆ {reason}</span>) : <span>◆ Model olasılığı, güven ve veri kalitesi birlikte değerlendirildi.</span>}<Link href={`/predictions?match=${prediction.matchId}`}>Analizi gör →</Link></div>
  </article>;
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const now = new Date();
  const archive = await loadDashboardPredictionSnapshot(5_000);
  const predictions = archive.filter((item) => isDateInSeason(item.kickoffAt, ACTIVE_SEASON_YEAR)).filter((item) => item.kickoffAt >= now && (item.settlementStatus === undefined || item.settlementStatus === "PENDING"));
  const primary = predictions.filter((item) => item.productionCandidateType === "PRIMARY_HOME");
  const selected = selectStrongestDashboardPredictions(primary, predictions).predictions;
  const strongest = selected[0] ?? [...predictions].sort((a,b) => b.productionScore-a.productionScore)[0];
  const featured = selected.slice(0, 3);
  const highConfidence = predictions.filter((item) => item.confidenceScore >= 70);
  const strong150 = highConfidence.filter((item) => fairOdds(item) >= 1.5).sort((a,b) => b.confidenceScore-a.confidenceScore).slice(0, 5);
  const averageConfidence = predictions.length ? predictions.reduce((sum,item)=>sum+item.confidenceScore,0)/predictions.length : 0;
  const averageProbability = predictions.length ? predictions.reduce((sum,item)=>sum+item.predictedProbability,0)/predictions.length : 0;
  const popular = ["HOME","DRAW","AWAY"].map(outcome=>({outcome,count:predictions.filter(item=>item.predictedOutcome===outcome).length})).sort((a,b)=>b.count-a.count)[0]?.outcome;
  const popularLabel = popular === "HOME" ? "Ev Sahibi" : popular === "AWAY" ? "Deplasman" : "Beraberlik";

  return <PageShell><main className={styles.page}>
    <header className={styles.hero}><div><p><i/> AI FUTBOL TAHMİNLERİ · CANLI VERİ</p><h1>Tahmin Merkezi</h1><span>Yapay zekâ destekli en güçlü maç tahminleri, tek ekranda.</span></div><aside><small>DAHA FAZLA ANALİZ</small><small>DAHA FAZLA KAZANÇ</small><i/></aside></header>
    <section className={styles.metrics}>
      <article><span>▣</span><div><small>Yaklaşan maç</small><strong>{predictions.length}</strong></div></article><article><span>♢</span><div><small>Yüksek güven</small><strong>{highConfidence.length}</strong></div></article><article><span>▥</span><div><small>Ortalama güven</small><strong>%{averageConfidence.toFixed(0)}</strong></div></article><article><span>◎</span><div><small>Ortalama tahmin</small><strong>%{averageProbability.toFixed(0)}</strong></div></article><article><span>♟</span><div><small>Popüler seçim</small><strong>{popularLabel}</strong></div></article>
    </section>
    <div className={styles.layout}>
      <section className={styles.predictionPanel}><header><div><h2>EN GÜÇLÜ TAHMİNLER</h2><p>En güçlü yaklaşan maçlar</p></div><Link href="/predictions">Tüm tahminler →</Link></header><div className={styles.matchList}>{featured.length ? featured.map(item=><PredictionRow prediction={item} key={item.matchId}/>) : <div className={styles.empty}>Yaklaşan güçlü tahmin bulunamadı. Veri yenilendiğinde burada gösterilecek.</div>}</div></section>
      <aside className={styles.side}>
        <section className={styles.featured}><header><span>★</span><div><h2>BUGÜNÜN ÖNE ÇIKANI</h2><p>En güçlü yaklaşan tahmin</p></div></header>{strongest ? <><div className={styles.featuredTeam}><TeamLogo src={strongest.predictedOutcome==="AWAY"?strongest.awayTeamLogo:strongest.homeTeamLogo} name={strongest.predictedOutcome==="AWAY"?strongest.awayTeam:strongest.homeTeam}/><div><strong>{strongest.predictedOutcome==="AWAY"?strongest.awayTeam:strongest.homeTeam}</strong><span>{outcomeLabel(strongest)}</span></div><b>GÜÇLÜ</b></div><div className={styles.featuredStats}><span>Güven <b>%{strongest.confidenceScore.toFixed(0)}</b></span><span>Oran <b>{fairOdds(strongest).toFixed(2)}</b></span><span>Beklenen gol <b>{(strongest.expectedHomeGoals+strongest.expectedAwayGoals).toFixed(1)}</b></span></div><Link href={`/predictions?match=${strongest.matchId}`}>▥ &nbsp; Analizi Gör →</Link></> : <div className={styles.empty}>Veri bekleniyor</div>}</section>
        <section className={styles.strongOdds}><header><span>♢</span><div><h2>GÜÇLÜ 1.50+ SEÇİMLER</h2><p>Yüksek oranlı, güvenilir tahminler</p></div><Link href="/predictions">Tümünü Gör →</Link></header><ol>{strong150.length ? strong150.map((item,index)=><li key={item.matchId}><span>{index+1}</span><div><strong>{item.homeTeam} – {item.awayTeam}</strong><small>{outcomeLabel(item)}</small></div><b>{fairOdds(item).toFixed(2)}</b><em>%{item.confidenceScore.toFixed(0)}</em></li>) : <li className={styles.noOdds}>1.50 üzeri güçlü seçim bulunamadı.</li>}</ol></section>
        <section className={styles.modelStatus}><header><span>◉</span><h2>MODEL DURUMU</h2><b><i/> Canlı ve aktif</b></header><div><span>Son veri kontrolü <b>Şimdi</b></span><span>Analiz edilen maç <b>{archive.length.toLocaleString("tr-TR")}</b></span><span>Tüm sistemler <b>Aktif</b></span></div><aside>✓ <span><strong>Model normal çalışıyor</strong><small>En güncel verilerle tahmin üretiliyor.</small></span></aside></section>
      </aside>
    </div>
    <footer className={styles.footer}><b>WINIQ</b><span>Daha akıllı tahminler. Daha büyük fırsatlar.</span><small>Futbol bir oyundur, istatistikler yol gösterir.</small></footer>
  </main></PageShell>;
}
