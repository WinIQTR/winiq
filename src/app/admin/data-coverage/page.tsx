import { requireAdmin } from "@/lib/auth-session";

import {
  PageShell,
} from "@/components/page-shell";

import {
  ACTIVE_COMPETITIONS,
} from "@/config/competitions";

import {
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

import {
  prisma,
} from "@/lib/prisma";

type CoverageRow = {
  apiId: number;
  name: string;
  shortName: string;
  leagueImported: boolean;
  seasonImported: boolean;
  teamCount: number;
  fixtureCount: number;
  finishedCount: number;
  advancedStatisticsCount: number;
  playerCount: number;
  injuryCount: number;
};

function statusLabel(count: number): {
  label: string;
  tone: "ok" | "warn" | "error";
} {
  if (count === 0) {
    return { label: "Veri yok", tone: "error" };
  }
  return { label: `${count}`, tone: "ok" };
}

export default async function DataCoveragePage() {
  await requireAdmin();

  const rows: CoverageRow[] = [];

  for (const competition of ACTIVE_COMPETITIONS) {
    const league = await prisma.league.findUnique({
      where: { apiId: competition.apiId },
      include: {
        seasons: {
          where: { year: ACTIVE_SEASON_YEAR },
          take: 1,
        },
      },
    });

    const season = league?.seasons[0] ?? null;

    const [matchTeamRows, fixtureCount, playerCount] = season
      ? await Promise.all([
          prisma.match.findMany({
            where: { seasonId: season.id },
            select: {
              homeTeamId: true,
              awayTeamId: true,
              status: true,
              teamStatistics: {
                select: {
                  shots: true,
                  shotsOnTarget: true,
                  corners: true,
                  offsides: true,
                  yellowCards: true,
                },
              },
            },
          }),
          prisma.match.count({
            where: { seasonId: season.id },
          }),
          prisma.playerSeasonStatistic.count({
            where: { seasonId: season.id },
          }),
        ])
      : [[], 0, 0];

    const teamCount = new Set(
      matchTeamRows.flatMap((match) => [match.homeTeamId, match.awayTeamId]),
    ).size;
    const finishedCount = matchTeamRows.filter((match) => match.status === "FINISHED").length;
    const advancedStatisticsCount = matchTeamRows.filter(
      (match) =>
        match.status === "FINISHED" &&
        match.teamStatistics.length >= 2 &&
        match.teamStatistics.every(
          (item) =>
            item.shots !== null &&
            item.shotsOnTarget !== null &&
            item.corners !== null &&
            item.offsides !== null &&
            item.yellowCards !== null,
        ),
    ).length;

    const injuryCount = season
      ? await prisma.injury.count({
          where: {
            player: {
              seasonStatistics: {
                some: { seasonId: season.id },
              },
            },
          },
        })
      : 0;

    rows.push({
      apiId: competition.apiId,
      name: competition.name,
      shortName: competition.shortName,
      leagueImported: Boolean(league),
      seasonImported: Boolean(season),
      teamCount,
      fixtureCount,
      finishedCount,
      advancedStatisticsCount,
      playerCount,
      injuryCount,
    });
  }

  return (
    <PageShell>
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">VERİ KAPSAMI</p>
          <h1>{ACTIVE_SEASON_YEAR} Sezonu — Lig Bazlı İçe Aktarma Durumu</h1>
          <p className="subtitle">
            Bu tablo doğrudan sizin veritabanınızı sorgular. &quot;Veri
            yok&quot; görünen bir satır, o lig için ilgili import
            endpoint&apos;inin henüz hiç çalıştırılmadığı anlamına gelir.
          </p>
        </div>

        <span className="mode-badge">ADMIN ONLY</span>
      </header>

      <section className="players-panel">
        <div className="players-table coverage-table">
          <div className="players-row players-header-row">
            <span>Lig</span>
            <span>Lig kaydı</span>
            <span>Sezon kaydı</span>
            <span>Takım</span>
            <span>Fikstür</span>
            <span>Biten</span>
            <span>İleri istatistik</span>
            <span>Oyuncu</span>
            <span>Sakatlık</span>
          </div>

          {rows.map((row) => {
            const team = statusLabel(row.teamCount);
            const fixture = statusLabel(row.fixtureCount);
            const advanced = statusLabel(row.advancedStatisticsCount);
            const player = statusLabel(row.playerCount);
            const injury = statusLabel(row.injuryCount);

            return (
              <div className="players-row" key={row.apiId}>
                <strong>{row.name}</strong>

                <span className={row.leagueImported ? "coverage-ok" : "coverage-error"}>
                  {row.leagueImported ? "Var" : "Yok"}
                </span>

                <span className={row.seasonImported ? "coverage-ok" : "coverage-error"}>
                  {row.seasonImported ? "Var" : "Yok"}
                </span>

                <span className={`coverage-${team.tone}`}>{team.label}</span>
                <span className={`coverage-${fixture.tone}`}>{fixture.label}</span>
                <span>{row.finishedCount}</span>
                <span className={`coverage-${advanced.tone}`}>
                  {advanced.label} / {row.finishedCount}
                </span>
                <span className={`coverage-${player.tone}`}>{player.label}</span>
                <span className={`coverage-${injury.tone}`}>{injury.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dashboard-muted" style={{ marginTop: 18 }}>
        <p>
          Eksik bir lig için sırasıyla şu endpoint&apos;leri çağırın (her
          biri admin oturumu gerektirir):
        </p>
        <ol>
          <li><code>POST /api/admin/import/league</code></li>
          <li><code>POST /api/admin/import/teams</code></li>
          <li><code>POST /api/admin/import/fixtures</code></li>
          <li><code>POST /api/admin/import/players</code></li>
          <li><code>POST /api/admin/import/injuries</code> (opsiyonel)</li>
          <li><code>pnpm run statistics:import-v9</code> (korner, ofsayt, kart ve şut)</li>
          <li><code>pnpm run statistics:coverage-v9</code> (kapsam kontrolü)</li>
        </ol>
      </section>
    </PageShell>
  );
}
