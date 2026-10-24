import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { requireMember } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  buildRefereeProfile,
  findRefereeNameForSlug,
  refereeNamesMatch,
  type RefereeStyleTone,
} from "@/lib/referee-profile";
import { syncRefereeMatchStatistics } from "@/lib/sync-referee-match-statistics";

import styles from "./referee.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toneClass(tone: RefereeStyleTone) {
  if (tone === "hard") return styles.hard;
  if (tone === "soft") return styles.soft;
  if (tone === "lenient") return styles.lenient;
  return styles.unknown;
}

export default async function MemberRefereePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireMember();
  const localReviewBypass = process.env.NODE_ENV !== "production";
  if (user.plan !== "PROFESSIONAL" && !localReviewBypass) redirect("/member/plans");

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const nameRows = await prisma.match.findMany({
    where: {
      season: { year: ACTIVE_SEASON_YEAR },
      referee: { not: null },
    },
    select: { referee: true },
    distinct: ["referee"],
    take: 5_000,
  });

  const allNames = nameRows
    .map((row) => row.referee?.trim())
    .filter((name): name is string => Boolean(name));

  const matchedName = findRefereeNameForSlug(slug, allNames);
  if (!matchedName) notFound();

  const finishedCandidates = await prisma.match.findMany({
    where: {
      season: { year: ACTIVE_SEASON_YEAR },
      status: "FINISHED",
      referee: { not: null },
    },
    orderBy: { kickoffAt: "desc" },
    take: 2_000,
    select: {
      id: true,
      apiId: true,
      referee: true,
      homeTeamId: true,
      awayTeamId: true,
      _count: { select: { teamStatistics: true } },
    },
  });

  const aliased = finishedCandidates.filter(
    (match) => match.referee && refereeNamesMatch(matchedName!, match.referee),
  );

  const missingStats = aliased.filter((match) => match._count.teamStatistics < 2);
  if (missingStats.length) {
    await syncRefereeMatchStatistics(missingStats, { maxMatches: 8 });
  }

  const finished = await prisma.match.findMany({
    where: {
      id: { in: aliased.map((match) => match.id) },
    },
    orderBy: { kickoffAt: "desc" },
    take: 80,
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { include: { league: { select: { name: true } } } },
      teamStatistics: {
        select: { yellowCards: true, redCards: true, fouls: true },
      },
    },
  });

  const profile = buildRefereeProfile(matchedName, finished);

  return (
    <main className={member.shell}>
      <MemberPortalHeader plan={user.plan} active="fixtures" />
      <div className={member.page}>
        <nav className={styles.back}>
          <Link href="/member/professional">← Analizler / Bu haftanın maçları</Link>
        </nav>

        <section className={styles.hero}>
          <div>
            <p>Hakem profili</p>
            <h1>{profile.name}</h1>
            <span>
              Sezon {ACTIVE_SEASON_YEAR} · bitmiş maçlardaki kart & faul toplamları (API-Football
              fixtures + fixtures/statistics; ayrı hakem kariyer endpoint’i yok)
            </span>
          </div>
          <div className={`${styles.badge} ${toneClass(profile.style)}`}>
            {profile.styleLabel.tr}
          </div>
        </section>

        <section className={styles.metrics}>
          <article>
            <span>Maç</span>
            <strong>{profile.matches || "—"}</strong>
          </article>
          <article>
            <span>Ort. kart yükü</span>
            <strong>
              {profile.averageCards != null ? profile.averageCards.toFixed(2) : "—"}
            </strong>
            <small>Sarı + 2×kırmızı / maç</small>
          </article>
          <article>
            <span>Sarı / Kırmızı</span>
            <strong>
              {profile.matches ? `${profile.yellowCards} / ${profile.redCards}` : "—"}
            </strong>
          </article>
          <article>
            <span>Ort. faul</span>
            <strong>
              {profile.averageFouls != null ? profile.averageFouls.toFixed(1) : "—"}
            </strong>
          </article>
        </section>

        <section className={styles.panel}>
          <header>
            <div>
              <h2>Son yönettiği maçlar</h2>
              <small>
                {profile.recent.length
                  ? "Kart ve faul toplamları her iki takım istatistiklerinden."
                  : aliased.length
                    ? "Bu hakem için bitmiş maç var ama istatistik satırı henüz yok / API boş."
                    : "Bu hakem için aktif sezonda bitmiş maç yok (yalnızca yaklaşan atama)."}
              </small>
            </div>
            <span>{profile.recent.length}</span>
          </header>
          {profile.recent.length ? (
            <div className={styles.table}>
              {profile.recent.map((match) => (
                <div className={styles.row} key={match.id}>
                  <small>{formatKickoff(match.kickoffAt)}</small>
                  <b>
                    {match.homeTeam} {match.homeScore ?? "–"}–{match.awayScore ?? "–"}{" "}
                    {match.awayTeam}
                  </b>
                  <span>{match.leagueName}</span>
                  <em>
                    {match.yellowCards}S / {match.redCards}K · {match.fouls} faul
                  </em>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              {aliased.length
                ? "Profil bekleniyor — maç istatistikleri henüz doğrulanamadı."
                : "Profil bekleniyor — bu sezonda yönettiği bitmiş maç yok."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
