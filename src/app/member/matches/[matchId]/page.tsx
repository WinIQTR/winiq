import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { requireMember } from "@/lib/auth-session";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import styles from "./member-match.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberMatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const user = await requireMember();
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId)) notFound();

  const predictions = await loadDashboardPredictionSnapshot(5_000);
  const prediction = predictions.find((item) => item.matchId === matchId);
  if (!prediction) notFound();

  const groups = buildBetMarketCatalog({
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
    locale: "tr",
  });

  return (
    <main className={`${member.shell} member-plan-${user.plan.toLowerCase()}`}>
      <MemberPortalHeader plan={user.plan} active="predictions"/>
      <div className={member.page}>
      <header className={styles.hero}>
        <div><p>WINIQ · AKILLI MAÇ ANALİZİ</p><h1>{prediction.homeTeam} <small>–</small> {prediction.awayTeam}</h1><span>{prediction.leagueName} · {new Date(prediction.kickoffAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" })}</span></div>
        <div><b>{MEMBERSHIP_PLAN_LABELS[user.plan]}</b><span>{MEMBERSHIP_PLAN_MARKET_LIMITS[user.plan]} pazar erişimi</span><Link href="/member/predictions">← Tüm tahminler</Link></div>
      </header>

      <section className={styles.overview}>
        <article><span>Ev sahibi</span><strong>%{prediction.homeProbability.toFixed(1)}</strong><small>{prediction.homeTeam}</small></article>
        <article><span>Beraberlik</span><strong>%{prediction.drawProbability.toFixed(1)}</strong><small>Model olasılığı</small></article>
        <article><span>Deplasman</span><strong>%{prediction.awayProbability.toFixed(1)}</strong><small>{prediction.awayTeam}</small></article>
        <article><span>Güven</span><strong>{prediction.confidenceScore.toFixed(1)}/100</strong><small>Model güven puanı</small></article>
        {user.plan === "PROFESSIONAL" ? <article><span>Beklenen gol</span><strong>{prediction.expectedHomeGoals.toFixed(2)} – {prediction.expectedAwayGoals.toFixed(2)}</strong><small>Profesyonel gösterge</small></article> : null}
      </section>

      {user.plan === "BASIC" ? <section className={styles.note}><strong>Sade görünüm açık</strong><span>Temel paket en çok kullanılan 6 pazarı gösterir. Diğer pazarları kilitli olarak inceleyebilirsiniz.</span></section> : null}
      {user.plan === "ANALYSIS" ? <section className={styles.note}><strong>Derin analiz açık</strong><span>19 pazardaki bütün seçeneklere, olasılıklara ve adil oranlara erişebilirsiniz.</span></section> : null}
      {user.plan === "PROFESSIONAL" ? <section className={styles.note}><strong>Tam profesyonel görünüm</strong><span>27 pazarın tamamı ve olay bazlı gelişmiş analizler açıktır. Veri bulunmayan alanlar açıkça belirtilir.</span></section> : null}

      <BetMarketCatalogPanel groups={groups} locale="tr" accessPlan={user.plan} />
      <section className={styles.notice}>WINIQ yalnızca bilgi ve model değerlendirmesi sunar. Kullanıcı kendi kararını verir; kupon veya kesin sonuç garantisi sunulmaz.</section>
      </div>
    </main>
  );
}
