import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireAdmin } from "@/lib/auth-session";
import { buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS, type MembershipPlanName } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

function parsePlan(value: string | string[] | undefined): MembershipPlanName {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === "ANALYSIS" || plan === "PROFESSIONAL" ? plan : "BASIC";
}

export default async function AdminMemberMatchPreview({ params, searchParams }: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  await requireAdmin();
  const plan = parsePlan((await searchParams).plan);
  const matchId = Number((await params).matchId);
  if (!Number.isInteger(matchId)) notFound();
  const prediction = (await loadDashboardPredictionSnapshot(5_000)).find((item) => item.matchId === matchId);
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

  return <main className={`member-shell member-match-shell member-plan-${plan.toLowerCase()}`}>
    <div className="member-preview-banner"><span>YÖNETİCİ ÖNİZLEMESİ</span><strong>{MEMBERSHIP_PLAN_LABELS[plan]} maç analizi</strong><Link href={`/admin/members/preview?plan=${plan}`}>Panele dön</Link></div>
    <header className="member-header"><div><p className="member-eyebrow">AKILLI MAÇ ANALİZİ</p><h1>{prediction.homeTeam} <small>–</small> {prediction.awayTeam}</h1><p>{prediction.leagueName}</p></div><div className="member-actions"><span className="plan-badge">{MEMBERSHIP_PLAN_LABELS[plan]} · {MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} pazar</span><LanguageSwitcher /></div></header>
    <section className="member-match-overview">
      <article><span>Ev sahibi</span><strong>%{prediction.homeProbability.toFixed(1)}</strong><small>{prediction.homeTeam}</small></article>
      <article><span>Beraberlik</span><strong>%{prediction.drawProbability.toFixed(1)}</strong><small>Model olasılığı</small></article>
      <article><span>Deplasman</span><strong>%{prediction.awayProbability.toFixed(1)}</strong><small>{prediction.awayTeam}</small></article>
      <article><span>Güven</span><strong>{prediction.confidenceScore.toFixed(1)}/100</strong><small>Model güven puanı</small></article>
      {plan === "PROFESSIONAL" ? <article><span>Beklenen gol</span><strong>{prediction.expectedHomeGoals.toFixed(2)} – {prediction.expectedAwayGoals.toFixed(2)}</strong><small>Profesyonel gösterge</small></article> : null}
    </section>
    <section className="member-smart-note"><strong>{plan === "BASIC" ? "Sade görünüm" : plan === "ANALYSIS" ? "Derin analiz" : "Tam profesyonel görünüm"}</strong><span>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} pazar erişime açık; üst paket pazarları seçim ve puan göstermeden kilitlenir.</span></section>
    <BetMarketCatalogPanel groups={groups} locale="tr" accessPlan={plan} />
  </main>;
}
