import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  MEMBERSHIP_PLAN_LABELS,
  MEMBERSHIP_PLAN_MARKET_LIMITS,
  type MembershipPlanName,
} from "@/lib/membership-access";
import { getPredictionLabel, type DashboardPrediction } from "@/lib/prediction-dashboard-shared";

const TURKEY_TIME_ZONE = "Europe/Istanbul";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIME_ZONE, hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function translateSelection(label: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/Home Team Goals/gi, "Ev sahibi takım golü"], [/Away Team Goals/gi, "Deplasman takım golü"],
    [/Total Goals/gi, "Toplam gol"], [/Both Teams To Score/gi, "Karşılıklı gol"],
    [/\bHome\b/gi, "Ev sahibi"], [/\bAway\b/gi, "Deplasman"], [/\bDraw\b/gi, "Beraberlik"],
    [/\bUnder\b/gi, "Alt"], [/\bOver\b/gi, "Üst"], [/\bYes\b/gi, "Evet"], [/\bNo\b/gi, "Hayır"],
  ];
  return replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), label);
}

function confidenceLabel(score: number): string {
  if (score >= 80) return "Çok güçlü";
  if (score >= 70) return "Güçlü";
  if (score >= 60) return "Dikkatli";
  return "Riskli";
}

function planMessage(plan: MembershipPlanName): string {
  if (plan === "BASIC") return "En çok kullanılan 6 pazarda sade ve anlaşılır tahminler.";
  if (plan === "ANALYSIS") return "19 pazar, ayrıntılı olasılıklar ve karşılaştırmalı analiz.";
  return "27 pazarın tamamı, profesyonel göstergeler ve gelişmiş karar araçları.";
}

export function MemberSmartDashboard({ name, plan, predictions, preview = false }: {
  name: string;
  plan: MembershipPlanName;
  predictions: DashboardPrediction[];
  preview?: boolean;
}) {
  const strongest = [...predictions].sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
  const strongCount = predictions.filter((item) => item.confidenceScore >= 70).length;
  const averageConfidence = predictions.length
    ? predictions.reduce((total, item) => total + item.confidenceScore, 0) / predictions.length : 0;
  const matchHref = (matchId: number) => preview
    ? `/admin/members/preview/matches/${matchId}?plan=${plan}`
    : `/member/matches/${matchId}`;

  return (
    <main className={`member-shell member-smart-shell member-plan-${plan.toLowerCase()}`}>
      {preview ? <div className="member-preview-banner"><span>YÖNETİCİ ÖNİZLEMESİ</span><strong>{MEMBERSHIP_PLAN_LABELS[plan]} üyenin gördüğü arayüz</strong><Link href="/admin/members">Önizlemeden çık</Link></div> : null}
      <header className="member-header member-smart-header">
        <div><p className="member-eyebrow">SMART MATCH CENTER</p><h1>Merhaba {name}</h1><p>{planMessage(plan)}</p></div>
        <div className="member-actions">
          <span className="plan-badge">{MEMBERSHIP_PLAN_LABELS[plan]}</span>
          <LanguageSwitcher />
          <Link className="member-plan-link" href={preview ? `/admin/members/preview?plan=${plan}#kuponlar` : "/member/coupons"}>Akıllı Kuponlar</Link>
          {!preview ? <Link className="member-plan-link" href="/member/messages">Mesajlar</Link> : null}
          <Link className="member-plan-link" href={preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans"}>Paketim</Link>
          {!preview ? <LogoutButton /> : null}
        </div>
      </header>

      <section className="member-smart-summary" aria-label="Günün özeti">
        <article><span>Bugünkü maç</span><strong>{predictions.length}</strong><small>Analize hazır</small></article>
        <article><span>Güçlü sinyal</span><strong>{strongCount}</strong><small>70+ güven puanı</small></article>
        <article><span>Ortalama güven</span><strong>%{averageConfidence.toFixed(0)}</strong><small>Bugünkü seçimler</small></article>
        <article><span>Açık pazar</span><strong>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]}</strong><small>27 pazar içinden</small></article>
      </section>

      {strongest ? <section className="member-hero-pick">
        <div><p className="member-eyebrow">GÜNÜN EN GÜÇLÜ SEÇİMİ</p><span>{strongest.leagueName} · {formatTime(strongest.kickoffAt)}</span><h2>{strongest.homeTeam} <small>–</small> {strongest.awayTeam}</h2></div>
        <div className="member-hero-choice"><span>Model seçimi</span><strong>{translateSelection(getPredictionLabel(strongest))}</strong><b>%{strongest.confidenceScore.toFixed(1)} güven</b></div>
        <Link href={matchHref(strongest.matchId)}>Akıllı analizi aç</Link>
      </section> : null}

      <div className="member-section-heading"><div><p className="member-eyebrow">BUGÜN</p><h2>Maç analizleri</h2></div><span>{predictions.length} karşılaşma</span></div>
      <section className="member-picks" aria-label="Bugünün maç analizleri">
        {predictions.length === 0 ? <article className="member-empty"><h2>Bugün için yayınlanmış tahmin yok</h2><p>Yeni seçimler veri işlemi tamamlandığında burada görünür.</p></article> : predictions.map((prediction) => (
          <article className="member-pick member-smart-pick" key={prediction.matchId}>
            <div className="member-pick-meta"><span>{prediction.leagueName}</span><time>{formatTime(prediction.kickoffAt)}</time></div>
            <h2>{prediction.homeTeam} <small>–</small> {prediction.awayTeam}</h2>
            <div className="member-selection"><span>Öne çıkan seçim</span><strong>{translateSelection(getPredictionLabel(prediction))}</strong></div>
            <div className="member-pick-score">
              <div><span>Güven</span><strong>%{prediction.confidenceScore.toFixed(1)}</strong></div>
              {plan !== "BASIC" ? <div><span>1 / X / 2</span><strong>%{prediction.homeProbability.toFixed(0)} · %{prediction.drawProbability.toFixed(0)} · %{prediction.awayProbability.toFixed(0)}</strong></div> : null}
              {plan === "PROFESSIONAL" ? <div><span>xG</span><strong>{prediction.expectedHomeGoals.toFixed(2)} – {prediction.expectedAwayGoals.toFixed(2)}</strong></div> : null}
            </div>
            <div className="member-pick-footer"><span className="member-confidence">{confidenceLabel(prediction.confidenceScore)}</span><Link href={matchHref(prediction.matchId)}>Analizi incele</Link></div>
          </article>
        ))}
      </section>

      <section className="member-plan-scope">
        <div><p className="member-eyebrow">PAKETİNİZ</p><h2>{MEMBERSHIP_PLAN_LABELS[plan]} üyelik kapsamı</h2><p>{MEMBERSHIP_PLAN_MARKET_LIMITS[plan]} bahis pazarı açık. Üst paketlerde kilitli pazarları ve daha ayrıntılı göstergeleri kullanabilirsiniz.</p></div>
        {plan !== "PROFESSIONAL" ? <Link href={preview ? `/admin/members/preview?plan=${plan}#paket` : "/member/plans"}>Paketleri karşılaştır</Link> : <span>Tüm özellikler açık</span>}
      </section>
      <section className="member-notice">Tahminler istatistiksel olasılık analizidir ve kesin sonuç garantisi vermez. Bütçenizi koruyun.</section>
    </main>
  );
}
