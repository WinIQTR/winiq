import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import { hasMembershipPermission } from "@/lib/membership-access";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { getPredictionLabel } from "@/lib/prediction-dashboard-shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MemberValuePage() {
  const user = await requireMember();
  if (
    !hasMembershipPermission(user.plan, "VALUE_BETS") &&
    !hasMembershipPermission(user.plan, "SMART_PICKS")
  ) {
    redirect("/member/plans");
  }

  const now = new Date();
  const rows = (await loadDashboardPredictionSnapshot(5_000))
    .filter(
      (item) =>
        item.kickoffAt >= now &&
        (item.settlementStatus === undefined || item.settlementStatus === "PENDING") &&
        item.confidenceScore >= 65,
    )
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 30);

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="value" />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p data-no-translate>WINIQ · DEĞER SEÇİMLERİ</p>
            <h1>Yüksek güvenli fırsatlar</h1>
            <span>
              Model oranı ve güven skoruna göre sıralı sade liste. Piyasa jargonu yok — sadece net seçim.
            </span>
          </div>
        </section>

        <div style={{ display: "grid", gap: 10 }}>
          {rows.length ? (
            rows.map((item, index) => {
              const odds =
                item.predictedProbability > 0 ? (100 / item.predictedProbability).toFixed(2) : "—";
              return (
                <article className={member.planChip} key={item.matchId}>
                  <small>
                    #{index + 1} · %{item.confidenceScore.toFixed(0)} güven · model oranı {odds}
                  </small>
                  <strong>
                    {item.homeTeam} – {item.awayTeam}
                  </strong>
                  <span style={{ color: "#9eb0c2", fontSize: 12 }}>
                    {item.leagueName} · {getPredictionLabel(item)}
                  </span>
                  <Link href={`/member/matches/${item.matchId}`}>Analizi gör →</Link>
                </article>
              );
            })
          ) : (
            <div className={member.upgrade}>Şu an listelenecek yüksek güvenli seçim yok.</div>
          )}
        </div>
      </div>
    </main>
  );
}
