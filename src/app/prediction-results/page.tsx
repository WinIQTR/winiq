import { PageShell } from "@/components/page-shell";
import { PredictionsWorkspace } from "@/components/predictions-workspace";
import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { loadPredictionSelectionAuditSnapshot } from "@/lib/prediction-selection-audit-snapshot";
import { prisma } from "@/lib/prisma";
import { buildTeamFormMap } from "@/lib/team-recent-form";

import styles from "./prediction-results.module.css";

export default async function PredictionResultsPage() {
  const finishedMatches = await prisma.match.findMany({
    where: {
      season: { year: ACTIVE_SEASON_YEAR },
      OR: [
        { status: "FINISHED" },
        {
          homeScore: { not: null },
          awayScore: { not: null },
        },
      ],
    },
    select: {
      id: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      season: {
        select: {
          league: {
            select: { apiId: true, name: true },
          },
        },
      },
      homeTeam: {
        select: { id: true, name: true, logoUrl: true },
      },
      awayTeam: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
    orderBy: { kickoffAt: "desc" },
    take: 5_000,
  });

  const [teamFormMap, snapshotPredictions, selectionAudits] = await Promise.all([
    buildTeamFormMap(ACTIVE_SEASON_YEAR),
    loadDashboardPredictionSnapshot(5_000),
    loadPredictionSelectionAuditSnapshot(20_000),
  ]);

  const fixtures = finishedMatches.map((match) => ({
    matchId: match.id,
    kickoffAt: match.kickoffAt,
    status: match.status,
    leagueApiId: match.season.league.apiId,
    leagueName: match.season.league.name,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeTeamLogo: match.homeTeam.logoUrl,
    awayTeamLogo: match.awayTeam.logoUrl,
    homeForm: teamFormMap.get(match.homeTeam.id) ?? [],
    awayForm: teamFormMap.get(match.awayTeam.id) ?? [],
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  }));

  const predictions = snapshotPredictions.filter((prediction) =>
    isDateInSeason(prediction.kickoffAt, ACTIVE_SEASON_YEAR),
  );

  return (
    <PageShell>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SONUÇ ARŞİVİ · {ACTIVE_SEASON_YEAR}</p>
          <h1>Tahmin Sonuçları</h1>
          <p>
            Sonuçlanmış maçlar, yayımlanan tahminler ve bütün pazar puanları
            ayrı bir arşivde incelenir.
          </p>
        </div>
        <span>GÜNCEL ARŞİV</span>
      </header>

      <section className={styles.resultsPanel}>
        <PredictionsWorkspace
          predictions={predictions}
          fixtures={fixtures}
          selectionAudits={selectionAudits}
          workspaceMode="FINISHED_RESULTS"
        />
      </section>
    </PageShell>
  );
}
