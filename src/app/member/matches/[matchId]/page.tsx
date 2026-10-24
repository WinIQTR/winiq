import Link from "next/link";
import { notFound } from "next/navigation";

import { BetMarketCatalogPanel } from "@/components/bet-market-catalog-panel";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { BET_MARKET_COUNT, buildBetMarketCatalog } from "@/lib/bet-market-catalog";
import { requireMember } from "@/lib/auth-session";
import { MEMBERSHIP_PLAN_LABELS, MEMBERSHIP_PLAN_MARKET_LIMITS } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel } from "@/lib/prediction-dashboard-shared";
import styles from "./member-match.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberMatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
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

  const topPicks = [...groups]
    .flatMap((group) =>
      group.options.slice(0, 1).map((option) => ({
        group: group.title,
        selection: option.selection,
        score: option.score,
        modelOdds: option.fairOdds,
      })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <main className={`${member.shell} member-plan-${user.plan.toLowerCase()}`}>
      <MemberPortalHeader plan={user.plan} active="predictions" />
      <div className={member.page}>
        <header className={styles.hero}>
          <div>
            <p data-no-translate>WINIQ · MAÇ</p>
            <h1>
              {prediction.homeTeam} <small>–</small> {prediction.awayTeam}
            </h1>
            <span>
              {prediction.leagueName} ·{" "}
              {new Date(prediction.kickoffAt).toLocaleString("tr-TR", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "Europe/Istanbul",
              })}
            </span>
          </div>
          <div>
            <b>{MEMBERSHIP_PLAN_LABELS[user.plan]}</b>
            <span>
              {MEMBERSHIP_PLAN_MARKET_LIMITS[user.plan]}/{BET_MARKET_COUNT} pazar
            </span>
            <Link href="/member/predictions">← Tüm tahminler</Link>
          </div>
        </header>

        <section className={styles.overview}>
          <article>
            <span>Öneri</span>
            <strong>{getPredictionLabel(prediction)}</strong>
            <small>
              {prediction.predictedOutcome === "HOME"
                ? prediction.homeTeam
                : prediction.predictedOutcome === "AWAY"
                  ? prediction.awayTeam
                  : "Beraberlik"}
            </small>
          </article>
          <article>
            <span>Güven</span>
            <strong>%{prediction.confidenceScore.toFixed(0)}</strong>
            <small>Modelin bu seçime güveni</small>
          </article>
          {user.plan !== "BASIC" ? (
            <article>
              <span>Ev / X / Dep</span>
              <strong>
                %{prediction.homeProbability.toFixed(0)} · %{prediction.drawProbability.toFixed(0)} · %
                {prediction.awayProbability.toFixed(0)}
              </strong>
              <small>Olasılık özeti</small>
            </article>
          ) : null}
        </section>

        <section className={member.scope}>
          <div>
            <small>ÖNERİLEN SEÇİMLER</small>
            <h2>Bu maç için ilk 3</h2>
            <p>Kataloğun tamamı aşağıda; önce net önerilere bakın.</p>
          </div>
        </section>
        <div style={{ display: "grid", gap: 8 }}>
          {topPicks.map((pick, index) => (
            <article className={member.planChip} key={`${pick.group}-${pick.selection}`}>
              <small>
                #{index + 1} · {pick.group}
              </small>
              <strong>{pick.selection}</strong>
              <span style={{ color: "#9eb0c2", fontSize: 12 }}>
                Güven %{pick.score.toFixed(0)}
                {user.plan !== "BASIC" ? ` · oran ${pick.modelOdds.toFixed(2)}` : ""}
              </span>
            </article>
          ))}
        </div>

        <BetMarketCatalogPanel groups={groups} locale="tr" accessPlan={user.plan} />
        <section className={styles.notice}>
          WINIQ yalnızca bilgi ve model değerlendirmesi sunar. Kullanıcı kendi kararını verir.
        </section>
      </div>
    </main>
  );
}
