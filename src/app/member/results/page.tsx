import Link from "next/link";

import { MemberPortalHeader, type MemberPerformance } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import { buildMarketPerformanceArchive } from "@/lib/market-performance-archive";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function performanceOf(
  predictions: Awaited<ReturnType<typeof loadDashboardPredictionSnapshot>>,
): MemberPerformance {
  const rows = buildMarketPerformanceArchive(predictions, { from: new Date(0), to: new Date() });
  const band = (tier: "STRONG" | "MEDIUM" | "WEAK") => {
    const tierRows = rows.filter((item) => item.tier === tier);
    const wins = tierRows.filter((item) => item.result === "WON").length;
    const losses = tierRows.filter((item) => item.result === "LOST").length;
    const voids = tierRows.filter((item) => item.result === "VOID").length;
    const unavailable = tierRows.filter((item) => item.result === "DATA_MISSING").length;
    const evaluated = wins + losses;
    return {
      rate: evaluated ? (wins / evaluated) * 100 : null,
      samples: evaluated,
      wins,
      losses,
      voids,
      unavailable,
      total: tierRows.length,
    };
  };
  return { strong: band("STRONG"), medium: band("MEDIUM"), weak: band("WEAK") };
}

export default async function MemberResultsPage() {
  const user = await requireMember();
  const all = await loadDashboardPredictionSnapshot(5_000);
  const performance = performanceOf(all);
  const settled = all
    .filter((item) => item.settlementStatus && item.settlementStatus !== "PENDING")
    .sort((a, b) => b.kickoffAt.getTime() - a.kickoffAt.getTime())
    .slice(0, 40);

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="results" />
      <div className={member.page}>
        <section className={member.welcome}>
          <div>
            <p data-no-translate>WINIQ · SONUÇLARIM</p>
            <h1>Geçmiş performans</h1>
            <span>Yayımlanmış seçimlerin tutma özeti. Bilgi amaçlıdır.</span>
          </div>
          <div className={member.quick}>
            <Link href="/member">Bugüne dön</Link>
          </div>
        </section>

        <section className={member.performance}>
          <header>
            <div>
              <small>ÖZET</small>
              <h2>Güçlü / orta / zayıf</h2>
            </div>
          </header>
          <div>
            {(
              [
                ["Güçlü", performance.strong],
                ["Orta", performance.medium],
                ["Zayıf", performance.weak],
              ] as const
            ).map(([label, item]) => (
              <article data-level={label} key={label}>
                <span>{label}</span>
                <strong>{item.rate === null ? "—" : `%${item.rate.toFixed(1)}`}</strong>
                <i>
                  <b style={{ width: `${item.rate ?? 0}%` }} />
                </i>
                <div className={member.performanceStats}>
                  <span>
                    <b>{item.wins}</b>Kazandı
                  </span>
                  <span>
                    <b>{item.losses}</b>Kaybetti
                  </span>
                  <span>
                    <b>{item.samples}</b>Değerlendirildi
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={member.scope}>
          <div>
            <small>SON MAÇLAR</small>
            <h2>Yakın sonuçlar</h2>
            <p>
              {settled.length
                ? `${settled.length} sonuçlandırılmış kayıt listeleniyor.`
                : "Henüz sonuçlandırılmış tahmin yok."}
            </p>
          </div>
        </section>

        <div className={member.page} style={{ padding: 0, gap: 8 }}>
          {settled.map((item) => (
            <article
              key={item.matchId}
              className={member.planChip}
              style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}
            >
              <div>
                <strong>
                  {item.homeTeam} – {item.awayTeam}
                </strong>
                <small style={{ display: "block", marginTop: 4, color: "#8ea4b9" }}>
                  {item.leagueName} ·{" "}
                  {item.kickoffAt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} ·{" "}
                  {item.settlementStatus}
                </small>
              </div>
              <Link href={`/member/matches/${item.matchId}`}>Detay</Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
