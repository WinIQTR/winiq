import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { LanguageSwitcher } from "@/components/language-switcher";
import { buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { requireMember } from "@/lib/auth-session";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

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
    <main className={`member-shell member-match-shell member-plan-${user.plan.toLowerCase()}`}>
      <header className="member-header">
        <div><p className="member-eyebrow">AKILLI MAÇ ANALİZİ</p><h1>{prediction.homeTeam} <small>–</small> {prediction.awayTeam}</h1><p>{prediction.leagueName} · {new Date(prediction.kickoffAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" })}</p></div>
        <div className="member-actions"><span className="plan-badge">{MEMBERSHIP_PLAN_LABELS[user.plan]} · {MEMBERSHIP_PLAN_MARKET_LIMITS[user.plan]} pazar</span><LanguageSwitcher /><Link className="member-back-link" href="/member">Maçlara dön</Link></div>
      </header>

      <section className="member-match-overview">
        <article><span>Ev sahibi</span><strong>%{prediction.homeProbability.toFixed(1)}</strong><small>{prediction.homeTeam}</small></article>
        <article><span>Beraberlik</span><strong>%{prediction.drawProbability.toFixed(1)}</strong><small>Model olasılığı</small></article>
        <article><span>Deplasman</span><strong>%{prediction.awayProbability.toFixed(1)}</strong><small>{prediction.awayTeam}</small></article>
        <article><span>Güven</span><strong>{prediction.confidenceScore.toFixed(1)}/100</strong><small>Model güven puanı</small></article>
        {user.plan === "PROFESSIONAL" ? <article><span>Beklenen gol</span><strong>{prediction.expectedHomeGoals.toFixed(2)} – {prediction.expectedAwayGoals.toFixed(2)}</strong><small>Profesyonel gösterge</small></article> : null}
      </section>

      {user.plan === "BASIC" ? <section className="member-smart-note"><strong>Sade görünüm açık</strong><span>Temel paket en çok kullanılan 6 pazarı gösterir. Diğer pazarları kilitli olarak inceleyebilirsiniz.</span></section> : null}
      {user.plan === "ANALYSIS" ? <section className="member-smart-note"><strong>Derin analiz açık</strong><span>19 pazardaki bütün seçeneklere, olasılıklara ve adil oranlara erişebilirsiniz.</span></section> : null}
      {user.plan === "PROFESSIONAL" ? <section className="member-smart-note"><strong>Tam profesyonel görünüm</strong><span>27 pazarın tamamı ve olay bazlı gelişmiş analizler açıktır. Veri bulunmayan alanlar açıkça belirtilir.</span></section> : null}

      <BetMarketCatalogPanel groups={groups} locale="tr" accessPlan={user.plan} />
      <section className="member-notice">Puanlar model değerlendirmesidir; bahis oranı veya kesin sonuç garantisi değildir.</section>
    </main>
  );
}
