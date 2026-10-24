import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { MemberWeekFixtures, type WeekFixtureRow } from "@/components/member-week-fixtures";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { requireMember } from "@/lib/auth-session";
import { resolveMatchWeatherBatch } from "@/lib/match-weather";
import { prisma } from "@/lib/prisma";
import { translateUiText } from "@/i18n/dictionaries";
import { readAppLocale } from "@/lib/app-locale-server";
import { buildMatchFormTip } from "@/lib/member-match-insight";
import { buildRefereeProfileMap } from "@/lib/referee-profile";
import { hasHotSupport } from "@/lib/team-display";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { syncMissingFixtureReferees } from "@/lib/sync-fixture-referees";

import styles from "./professional.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type View = "fixtures" | "players" | "scorers" | "standings";
const validViews = new Set<View>(["fixtures", "players", "scorers", "standings"]);
const formatDate = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
type FormResult = "W" | "D" | "L";
const positionName = (value:string) => ({GOALKEEPER:"Kaleci",DEFENDER:"Defans",MIDFIELDER:"Orta saha",FORWARD:"Forvet",UNKNOWN:"Belirsiz"}[value] ?? "Tümü");

export default async function ProfessionalDataPage({ searchParams }: { searchParams: Promise<{ view?: string; league?: string; team?: string; position?: string; q?: string; week?: string; stage?: string; table?: string }> }) {
  const user = await requireMember();
  const locale = await readAppLocale();
  // Local review: allow any logged-in member to open the redesigned Analizler list.
  // Production still requires PROFESSIONAL.
  const localReviewBypass = process.env.NODE_ENV !== "production";
  if (user.plan !== "PROFESSIONAL" && !localReviewBypass) redirect("/member/plans");
  const params = await searchParams;
  const requested = params.view as View | undefined;
  const view: View = requested && validViews.has(requested) ? requested : "fixtures";
  const leagueFilter = Number(params.league) || 0;
  const teamFilter = Number(params.team) || 0;
  const position = ["GOALKEEPER","DEFENDER","MIDFIELDER","FORWARD"].includes((params.position??"").toUpperCase()) ? (params.position!.toUpperCase() as "GOALKEEPER"|"DEFENDER"|"MIDFIELDER"|"FORWARD") : "ALL";
  const query = (params.q ?? "").trim();
  const standingMode = params.table === "home" || params.table === "away" ? params.table : "overall";
  const now = new Date();
  const week = Math.max(-1, Math.min(1, Number(params.week) || 0));
  const weekStart = new Date(now); weekStart.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7) + week * 7); weekStart.setUTCHours(0,0,0,0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [fixtures, players, scorers, finishedMatches, leagues, teamMatches, predictionSnapshot] = await Promise.all([
    view === "fixtures" ? prisma.match.findMany({
      where: { season: { year: ACTIVE_SEASON_YEAR, ...(leagueFilter ? { leagueId: leagueFilter } : {}) }, ...(teamFilter ? { OR: [{ homeTeamId: teamFilter }, { awayTeamId: teamFilter }] } : {}), kickoffAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { kickoffAt: "asc" }, take: 120,
      include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true, featureValues: { include: { feature: true } } },
    }) : Promise.resolve([]),
    view === "players" ? prisma.playerSeasonStatistic.findMany({
      where: { season: { year: ACTIVE_SEASON_YEAR, ...(leagueFilter ? { leagueId: leagueFilter } : {}) }, ...(teamFilter ? { teamId: teamFilter } : {}), appearances: { gt: 0 }, ...(position !== "ALL" || query ? { player: { ...(position !== "ALL" ? { position } : {}), ...(query ? { name: { contains: query, mode: "insensitive" } } : {}) } } : {}) },
      orderBy: [{ appearances: "desc" }, { averageRating: "desc" }, { minutes: "desc" }], take: 80,
      include: { player: { include: { injuries: { where: { actualReturnDate: null }, take: 1 } } }, team: true, season: { include: { league: true } } },
    }) : Promise.resolve([]),
    view === "scorers" ? prisma.playerSeasonStatistic.findMany({
      where: { season: { year: ACTIVE_SEASON_YEAR, ...(leagueFilter ? { leagueId: leagueFilter } : {}) }, ...(teamFilter ? { teamId: teamFilter } : {}), appearances: { gt: 0 }, ...(query ? { player: { name: { contains: query, mode: "insensitive" } } } : {}) },
      orderBy: [{ goals: "desc" }, { assists: "desc" }, { minutes: "asc" }], take: 50,
      include: { player: true, team: true, season: { include: { league: true } } },
    }) : Promise.resolve([]),
    (view === "fixtures" || view === "standings") ? prisma.match.findMany({
      where: { season: { year: ACTIVE_SEASON_YEAR }, status: "FINISHED", kickoffAt: { lt: now } },
      orderBy: { kickoffAt: "asc" },
      include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true, teamStatistics: true },
    }) : Promise.resolve([]),
    prisma.league.findMany({ where: { seasons: { some: { year: ACTIVE_SEASON_YEAR } } }, orderBy: { name: "asc" }, select: { id: true, name: true, apiId: true } }),
    prisma.match.findMany({ where: { season: { year: ACTIVE_SEASON_YEAR, ...(leagueFilter ? { leagueId: leagueFilter } : {}) } }, select: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } } }),
    view === "fixtures" ? loadDashboardPredictionSnapshot(20_000) : Promise.resolve([]),
  ]);
  const teamMap = new Map<number,{id:number;name:string}>(); for (const match of teamMatches) { teamMap.set(match.homeTeam.id,match.homeTeam); teamMap.set(match.awayTeam.id,match.awayTeam); } const teams=[...teamMap.values()].sort((a,b)=>a.name.localeCompare(b.name,"tr"));
  const predictionByMatch = new Map(predictionSnapshot.map(item => [item.matchId, item]));

  const points = new Map<string, number>();
  for (const match of finishedMatches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    const homeKey = `${match.seasonId}:${match.homeTeamId}`;
    const awayKey = `${match.seasonId}:${match.awayTeamId}`;
    points.set(homeKey, (points.get(homeKey) ?? 0) + (match.homeScore > match.awayScore ? 3 : match.homeScore === match.awayScore ? 1 : 0));
    points.set(awayKey, (points.get(awayKey) ?? 0) + (match.awayScore > match.homeScore ? 3 : match.homeScore === match.awayScore ? 1 : 0));
  }
  const leaderBySeason = new Map<number, number>();
  for (const [key, value] of points) {
    const [seasonId, teamId] = key.split(":").map(Number);
    const current = leaderBySeason.get(seasonId);
    if (current === undefined || value > (points.get(`${seasonId}:${current}`) ?? -1)) leaderBySeason.set(seasonId, teamId);
  }
  const recentForm = (teamId: number, kickoffAt: Date, side: "any" | "home" | "away" = "any"): FormResult[] =>
    finishedMatches
      .filter((match) => {
        if (match.kickoffAt >= kickoffAt || match.homeScore === null || match.awayScore === null) return false;
        if (side === "home") return match.homeTeamId === teamId;
        if (side === "away") return match.awayTeamId === teamId;
        return match.homeTeamId === teamId || match.awayTeamId === teamId;
      })
      .slice(-5)
      .map((match) => {
        const home = match.homeTeamId === teamId;
        const own = home ? match.homeScore! : match.awayScore!;
        const opponent = home ? match.awayScore! : match.homeScore!;
        return own > opponent ? "W" : own < opponent ? "L" : "D";
      });
  const tipTranslate = (source: string) => translateUiText(source, locale);
  const fixturesForWeek = view === "fixtures" ? fixtures : [];

  if (view === "fixtures" && fixtures.length) {
    await syncMissingFixtureReferees(
      fixtures.map((match) => ({
        id: match.id,
        apiId: match.apiId,
        referee: match.referee,
        venueName: match.venueName,
        venueCity: match.venueCity,
      })),
      { maxBatches: 2 },
    );
    const refreshed = await prisma.match.findMany({
      where: { id: { in: fixtures.map((match) => match.id) } },
      select: { id: true, referee: true, venueName: true, venueCity: true },
    });
    const refreshedById = new Map(refreshed.map((row) => [row.id, row]));
    for (const match of fixtures) {
      const next = refreshedById.get(match.id);
      if (!next) continue;
      match.referee = next.referee;
      match.venueName = next.venueName ?? match.venueName;
      match.venueCity = next.venueCity ?? match.venueCity;
    }
  }

  const weatherByMatch =
    view === "fixtures" && fixturesForWeek.length
      ? await resolveMatchWeatherBatch(
          fixturesForWeek.map((match) => ({
            matchId: match.id,
            kickoffAt: match.kickoffAt,
            venueCity: match.venueCity ?? match.homeTeam.venueCity ?? null,
          })),
          { locale, maxFetches: 16 },
        )
      : new Map();

  const refereeProfiles =
    view === "fixtures"
      ? buildRefereeProfileMap(
          fixtures.map((match) => match.referee),
          finishedMatches,
        )
      : new Map();

  const weekFixtureRows: WeekFixtureRow[] =
    view === "fixtures"
      ? fixturesForWeek.map((match) => {
          const homeForm = recentForm(match.homeTeamId, match.kickoffAt);
          const awayForm = recentForm(match.awayTeamId, match.kickoffAt);
          const homeVenueForm = recentForm(match.homeTeamId, match.kickoffAt, "home");
          const awayVenueForm = recentForm(match.awayTeamId, match.kickoffAt, "away");
          const leader = leaderBySeason.get(match.seasonId);
          const prediction = predictionByMatch.get(match.id);
          const refereeName = match.referee?.trim() || null;
          const profile = refereeName ? refereeProfiles.get(refereeName) ?? null : null;
          const formTip = buildMatchFormTip(
            {
              homeTeam: match.homeTeam.name,
              awayTeam: match.awayTeam.name,
              homeRecentResults: homeForm,
              awayRecentResults: awayForm,
              homeVenueResults: homeVenueForm,
              awayVenueResults: awayVenueForm,
            },
            tipTranslate,
          );
          return {
            id: match.id,
            kickoffAt: match.kickoffAt,
            referee: refereeName,
            refereeProfile: profile
              ? {
                  matches: profile.matches,
                  averageCards: profile.averageCards,
                  style: profile.style,
                  styleLabel: profile.styleLabel,
                }
              : null,
            venueName: match.venueName ?? match.homeTeam.venueName,
            venueCapacity: match.homeTeam.venueCapacity,
            leagueName: match.season.league.name,
            leagueApiId: match.season.league.apiId ?? null,
            leagueLogoUrl: match.season.league.logoUrl,
            formTip,
            home: {
              id: match.homeTeamId,
              name: match.homeTeam.name,
              logoUrl: match.homeTeam.logoUrl,
              form: homeForm,
              homeForm: homeVenueForm,
              isLeader: leader === match.homeTeamId,
              isHot: hasHotSupport(match.homeTeam.name),
              favoritePct:
                prediction?.predictedOutcome === "HOME" ? prediction.predictedProbability : null,
            },
            away: {
              id: match.awayTeamId,
              name: match.awayTeam.name,
              logoUrl: match.awayTeam.logoUrl,
              form: awayForm,
              awayForm: awayVenueForm,
              isLeader: leader === match.awayTeamId,
              isHot: hasHotSupport(match.awayTeam.name),
              favoritePct:
                prediction?.predictedOutcome === "AWAY" ? prediction.predictedProbability : null,
            },
            weather: weatherByMatch.get(match.id) ?? null,
          };
        })
      : [];

  const recentResults = [...finishedMatches].reverse().filter(match => (!leagueFilter || match.season.leagueId === leagueFilter) && (!teamFilter || match.homeTeamId === teamFilter || match.awayTeamId === teamFilter)).slice(0, 20);
  const selectedLeague=leagues.find(item=>item.id===leagueFilter); const selectedMeta=ACTIVE_COMPETITIONS.find(item=>item.apiId===selectedLeague?.apiId);
  const stageOf=(round:string|null)=>{const value=(round??"").toLocaleLowerCase("tr-TR");if(value.includes("qualif"))return"Elemeler";if(value.includes("play-off")||value.includes("playoff"))return"Play-off";if(value.includes("league phase"))return"Lig Aşaması";if(value.includes("group"))return"Grup Aşaması";if(value.includes("round of")||value.includes("quarter")||value.includes("semi")||value.includes("final"))return"Eleme Turları";return"Normal Sezon";};
  const leagueMatches=finishedMatches.filter(item=>item.season.leagueId===leagueFilter); const stages=[...new Set(leagueMatches.map(item=>stageOf(item.round)))]; const requestedStage=stages.find(item=>item===params.stage); const activeStage=requestedStage??stages.find(item=>item==="Lig Aşaması"||item==="Normal Sezon")??stages[0];
  const standingMap = new Map<number,{id:number;name:string;logoUrl:string|null;venueName:string|null;venueCapacity:number|null;played:number;won:number;drawn:number;lost:number;gf:number;ga:number;points:number}>();
  if (leagueFilter) for (const match of leagueMatches.filter(item=>selectedMeta?.kind!=="EUROPEAN_CUP"||stageOf(item.round)===activeStage)) {
    if (match.homeScore===null||match.awayScore===null) continue;
    const home=standingMap.get(match.homeTeamId)??{id:match.homeTeamId,name:match.homeTeam.name,logoUrl:match.homeTeam.logoUrl,venueName:match.homeTeam.venueName,venueCapacity:match.homeTeam.venueCapacity,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0};
    const away=standingMap.get(match.awayTeamId)??{id:match.awayTeamId,name:match.awayTeam.name,logoUrl:match.awayTeam.logoUrl,venueName:match.awayTeam.venueName,venueCapacity:match.awayTeam.venueCapacity,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0};
    if (standingMode !== "away") { home.played++; home.gf+=match.homeScore; home.ga+=match.awayScore; }
    if (standingMode !== "home") { away.played++; away.gf+=match.awayScore; away.ga+=match.homeScore; }
    if(match.homeScore>match.awayScore){if(standingMode !== "away"){home.won++;home.points+=3;}if(standingMode !== "home")away.lost++;}else if(match.awayScore>match.homeScore){if(standingMode !== "home"){away.won++;away.points+=3;}if(standingMode !== "away")home.lost++;}else{if(standingMode !== "away"){home.drawn++;home.points++;}if(standingMode !== "home"){away.drawn++;away.points++;}}
    standingMap.set(home.id,home); standingMap.set(away.id,away);
  }
  const standings=[...standingMap.values()].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
  const dateKey=(value:Date)=>new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Europe/Istanbul"}).format(value);
  const standingsFinished=leagueMatches.filter(item=>(selectedMeta?.kind!=="EUROPEAN_CUP"||stageOf(item.round)===activeStage)&&item.homeScore!==null&&item.awayScore!==null);
  const latestStandingsMatchDay=standingsFinished.length?dateKey(standingsFinished[standingsFinished.length-1]!.kickoffAt):null;
  const previousStandingPoints=new Map<number,{gf:number;ga:number;points:number}>();
  for(const team of standingMap.values())previousStandingPoints.set(team.id,{gf:0,ga:0,points:0});
  for(const match of standingsFinished){
    if(latestStandingsMatchDay&&dateKey(match.kickoffAt)===latestStandingsMatchDay)continue;
    const home=previousStandingPoints.get(match.homeTeamId),away=previousStandingPoints.get(match.awayTeamId);
    if(!home||!away)continue;
    if(standingMode!=="away"){home.gf+=match.homeScore!;home.ga+=match.awayScore!;}
    if(standingMode!=="home"){away.gf+=match.awayScore!;away.ga+=match.homeScore!;}
    if(match.homeScore!>match.awayScore!){if(standingMode!=="away")home.points+=3;}
    else if(match.awayScore!>match.homeScore!){if(standingMode!=="home")away.points+=3;}
    else{if(standingMode!=="away")home.points++;if(standingMode!=="home")away.points++;}
  }
  const previousStandingPositions=new Map([...previousStandingPoints.entries()].sort(([,a],[,b])=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf).map(([id],index)=>[id,index+1]));
  const standingMovement=(teamId:number,position:number)=>{const previousPosition=previousStandingPositions.get(teamId);return previousPosition?previousPosition-position:0;};

  const title = view === "fixtures" ? "Fixture centre" : view === "players" ? "Player centre" : view === "scorers" ? "Top scorers" : "Standings";
  const description = view === "fixtures" ? "Matches from the previous, current and upcoming week." : view === "players" ? "Season performance for active squad players." : view === "scorers" ? "Attack leaders by goals, assists and minutes." : "Standings for the selected league from verified results.";
  return <main className={member.shell}>
    <MemberPortalHeader plan={user.plan} active={view}/>
    {localReviewBypass && user.plan !== "PROFESSIONAL" ? (
      <div className={styles.localReviewBanner} role="status">
        Local review: this page is open to all member plans in development. Production requires Professional.
      </div>
    ) : null}
    <nav className={styles.sourceLinks} aria-label="Profesyonel veri merkezleri"><Link href={`/teams${leagueFilter ? `?league=${leagues.find(item=>item.id===leagueFilter)?.apiId ?? ""}` : ""}`}>Takım profilleri ve gelişmiş puan durumu →</Link><Link href={`/fixtures${leagueFilter ? `?league=${leagues.find(item=>item.id===leagueFilter)?.apiId ?? ""}` : ""}`}>Fikstür, skorlar ve maç detayları →</Link></nav><nav className={styles.standingModeLinks} aria-label="Puan durumu görünümü"><span>Tablo görünümü</span><Link data-active={standingMode === "overall"} href={`/member/professional?view=standings&league=${leagueFilter}`}>Genel</Link><Link data-active={standingMode === "home"} href={`/member/professional?view=standings&league=${leagueFilter}&table=home`}>İç saha</Link><Link data-active={standingMode === "away"} href={`/member/professional?view=standings&league=${leagueFilter}&table=away`}>Deplasman</Link></nav>
    <div className={member.page}>
      <section className={member.welcome}><div><p><i/> WINIQ · PROFESSIONAL DATA CENTRE</p><h1>{title}</h1><span>{description}</span></div></section>
      <nav className={styles.tabs}>{(["fixtures", "players", "scorers", "standings"] as View[]).map(item => <Link data-active={item === view} href={`/member/professional?view=${item}`} key={item}>{item === "fixtures" ? "Fixture centre" : item === "players" ? "Players" : item === "scorers" ? "Top scorers" : "Standings"}</Link>)}<Link href="/member/professional/special">Special List</Link></nav>
      <nav className={styles.leagueTabs}><Link data-active={!leagueFilter} href={`/member/professional?view=${view}`}>ALL<span>All leagues</span></Link>{leagues.map(league=>{const meta=ACTIVE_COMPETITIONS.find(item=>item.apiId===league.apiId);return <Link data-active={league.id===leagueFilter} href={`/member/professional?view=${view}&league=${league.id}`} key={league.id}>{meta?.shortName??league.name.slice(0,3).toUpperCase()}<span>{league.name}</span></Link>})}</nav>
      {view === "fixtures" ? <><nav className={styles.weekTabs}>{[[-1,"← Previous week"],[0,"This week"],[1,"Next week →"]].map(([value,label])=><Link data-active={week===Number(value)} href={`/member/professional?view=fixtures&week=${value}${leagueFilter?`&league=${leagueFilter}`:""}${teamFilter?`&team=${teamFilter}`:""}`} key={value}>{label}</Link>)}</nav><form className={styles.filters} action="/member/professional"><input type="hidden" name="view" value="fixtures"/><input type="hidden" name="week" value={week}/><label><span>League</span><select name="league" defaultValue={leagueFilter}><option value="0">All leagues</option>{leagues.map(league=><option value={league.id} key={league.id}>{league.name}</option>)}</select></label><label><span>Team</span><select name="team" defaultValue={teamFilter}><option value="00">All teams</option>{teams.map(team=><option value={team.id} key={team.id}>{team.name}</option>)}</select></label><button type="submit">Fetch list</button><Link href="/member/professional?view=fixtures">Clear</Link></form>
      <MemberWeekFixtures
        title={week === -1 ? "Previous week" : week === 1 ? "Next week" : "This week's matches"}
        rangeLabel={`${formatDate(weekStart)} – ${formatDate(new Date(weekEnd.getTime() - 1))}`}
        rows={weekFixtureRows}
      />
      <section className={`${styles.panel} ${styles.history}`}><header><div><h2>Past matches and stats</h2><small>Last {recentResults.length} matches for the selected league or team</small></div><span>Verified results</span></header><div className={styles.historyList}>{recentResults.map(match=>{const home=match.teamStatistics.find(row=>row.teamId===match.homeTeamId),away=match.teamStatistics.find(row=>row.teamId===match.awayTeamId);return <details key={match.id}><summary><small>{formatDate(match.kickoffAt)} · {match.season.league.name}</small><b>{match.homeTeam.name} <strong>{match.homeScore} – {match.awayScore}</strong> {match.awayTeam.name}</b><span>Show statistics</span></summary><div><span>Shots <b>{home?.shots??"—"} – {away?.shots??"—"}</b></span><span>Shots on target <b>{home?.shotsOnTarget??"—"} – {away?.shotsOnTarget??"—"}</b></span><span>Possession <b>{home?.possession??"—"}% – {away?.possession??"—"}%</b></span><span>Corners <b>{home?.corners??"—"} – {away?.corners??"—"}</b></span><span>Cards <b>{home?.yellowCards??"—"} – {away?.yellowCards??"—"}</b></span><span>xG <b>{home?.expectedGoals??"—"} – {away?.expectedGoals??"—"}</b></span></div></details>})}</div></section></> : null}
      {view === "players" ? <><nav className={styles.teamTabs}><Link data-active={!teamFilter} href={`/member/professional?view=players${leagueFilter?`&league=${leagueFilter}`:""}`}>Tüm takımlar</Link>{teams.map(team=><Link data-active={team.id===teamFilter} href={`/member/professional?view=players${leagueFilter?`&league=${leagueFilter}`:""}&team=${team.id}`} key={team.id}>{team.name}</Link>)}</nav><section className={styles.metrics}><article><span>Kadro</span><strong>{players.length}</strong></article><article><span>Oynayan</span><strong>{players.filter(row=>row.appearances>0).length}</strong></article><article><span>Eksik / sakat</span><strong>{players.filter(row=>row.player.injuries.length).length}</strong></article><article><span>Yıldız oyuncu</span><strong>{players.filter(row=>(row.averageRating??0)>=7.5||row.goals+row.assists>=10).length}</strong></article></section><form className={styles.playerTools} action="/member/professional"><input type="hidden" name="view" value="players"/><input type="hidden" name="league" value={leagueFilter}/><input type="hidden" name="team" value={teamFilter}/><nav>{[["ALL","Tümü"],["GOALKEEPER","Kaleci"],["DEFENDER","Defans"],["MIDFIELDER","Orta Saha"],["FORWARD","Forvet"]].map(([key,label])=><Link data-active={position===key} href={`/member/professional?view=players&league=${leagueFilter}&team=${teamFilter}&position=${key}`} key={key}>{label}</Link>)}</nav><input name="q" defaultValue={query} placeholder="Oyuncu ara…"/><button>Ara</button></form><section className={styles.panel}><header><div><h2>Kadro ve sezon performansı</h2><small>★ Rating 7.50+ veya 10+ gol katkısı olan yıldız oyuncu</small></div><span>{players.length} oyuncu</span></header><div className={styles.playerCards}>{players.map(row=>{const star=(row.averageRating??0)>=7.5||row.goals+row.assists>=10;return <details className={`${styles.playerCard} ${star?styles.starCard:""}`} key={row.id}><summary><div className={styles.person}>{row.player.photoUrl?<Image src={row.player.photoUrl} alt="" width={48} height={48}/>:null}<span><b>{star?"★ ":""}{row.player.name}</b><small>{positionName(row.player.position)} · {row.player.nationality??"Uyruk bekleniyor"}{row.player.injuries.length?" · EKSİK / SAKAT":""}</small></span></div><strong>{row.goals} gol · {row.assists} asist</strong></summary><div className={styles.playerDetails}><span>Maç / ilk 11<b>{row.appearances} / {row.starts}</b></span><span>Dakika<b>{row.minutes}</b></span><span>Rating<b>{row.averageRating?.toFixed(2)??"—"}</b></span><span>Şut / isabet<b>{row.shots} / {row.shotsOnTarget}</b></span><span>Pas / isabet<b>{row.passes} / {row.passAccuracy??"—"}%</b></span><span>Kilit pas<b>{row.keyPasses}</b></span><span>Dribbling<b>{row.successfulDribbles}/{row.dribbleAttempts}</b></span><span>İkili mücadele<b>{row.duelsWon}/{row.duels}</b></span><span>Kart S/K<b>{row.yellowCards}/{row.redCards}</b></span><span>Boy / kilo<b>{row.player.heightCm??"—"} / {row.player.weightKg??"—"}</b></span></div></details>})}</div></section></> : null}
      {view === "scorers" ? <><section className={styles.metrics}><article><span>Lider</span><strong>{scorers[0]?.player.name??"—"}</strong></article><article><span>Lider gol</span><strong>{scorers[0]?.goals??0}</strong></article><article><span>Gol atan oyuncu</span><strong>{scorers.filter(row=>row.goals>0).length}</strong></article><article><span>Toplam gol</span><strong>{scorers.reduce((sum,row)=>sum+row.goals,0)}</strong></article></section><form className={styles.scorerTools} action="/member/professional"><input type="hidden" name="view" value="scorers"/><input type="hidden" name="league" value={leagueFilter}/><select name="team" defaultValue={teamFilter}><option value="0">Tüm takımlar</option>{teams.map(team=><option value={team.id} key={team.id}>{team.name}</option>)}</select><input name="q" defaultValue={query} placeholder="Golcü ara…"/><button>Listeyi getir</button></form><section className={styles.panel}><header><h2>Gol & hücum liderleri</h2><span>İlk {scorers.length}</span></header><div className={styles.scorerCards}>{scorers.map((row,index)=><details className={`${styles.scorerCard} ${index<3?styles.podium:""}`} key={row.id}><summary><b className={styles.rank}>#{index+1}</b><span className={styles.person}>{row.player.photoUrl?<Image src={row.player.photoUrl} alt="" width={46} height={46}/>:null}<span><b>{row.player.name}</b><small>{row.team.name} · {row.appearances} maç</small></span></span><strong>{row.goals} GOL</strong></summary><div className={styles.playerDetails}><span>Asist<b>{row.assists}</b></span><span>Dakika<b>{row.minutes}</b></span><span>Gol / 90<b>{row.minutes?(row.goals*90/row.minutes).toFixed(2):"—"}</b></span><span>Gol başına dk.<b>{row.goals?Math.round(row.minutes/row.goals):"—"}</b></span><span>Şut / isabet<b>{row.shots}/{row.shotsOnTarget}</b></span><span>Rating<b>{row.averageRating?.toFixed(2)??"—"}</b></span><span>Penaltı gol/kaçan<b>{row.penaltiesScored}/{row.penaltiesMissed}</b></span><span>İlk 11<b>{row.starts}</b></span></div></details>)}</div></section></> : null}
      {view === "standings" ? !leagueFilter?<section className={styles.emptyState}><strong>Bir lig seçin</strong><span>Puan durumunu görmek için yukarıdaki liglerden birini seçin.</span></section>:<>{selectedMeta?.kind==="EUROPEAN_CUP"?<nav className={styles.stageTabs}>{stages.map(stage=><Link data-active={stage===activeStage} href={`/member/professional?view=standings&league=${leagueFilter}&stage=${encodeURIComponent(stage)}`} key={stage}>{stage}</Link>)}</nav>:null}{activeStage==="Eleme Turları"?<section className={styles.stageNote}>Eleme turlarında ortak lig tablosu oluşturulmaz. Buradaki sıralama yalnız seçilen tur maçlarının bilgi özetidir.</section>:null}<section className={styles.panel}><header><div><h2>{selectedLeague?.name} · {activeStage} puan durumu</h2><small>Play-off, eleme, grup ve lig aşamaları birbirine karıştırılmaz.</small></div><span>{standings.length} takım</span></header><div className={styles.standingsWrap}><div className={`${styles.standingRow} ${styles.standingHead}`}><span>#</span><span>Takım</span><span>Hareket</span><span>O</span><span>G</span><span>B</span><span>M</span><span>AG</span><span>YG</span><span>AV</span><span>P</span><span>Form</span></div>{standings.map((row,index)=>{const position=index+1;const movement=standingMovement(row.id,position);return <div className={styles.standingRow} key={row.id}><b>{position}</b><span className={styles.standingTeam}>{row.logoUrl?<Image src={row.logoUrl} alt="" width={28} height={28}/>:null}<strong>{row.name}</strong>{index===0?<em>★ Lider</em>:null}</span><span className={movement>0?styles.rankUp:movement<0?styles.rankDown:styles.rankSame}>{movement>0?`▲ ${movement}`:movement<0?`▼ ${Math.abs(movement)}`:"—"}</span><span>{row.played}</span><span>{row.won}</span><span>{row.drawn}</span><span>{row.lost}</span><span>{row.gf}</span><span>{row.ga}</span><span>{row.gf-row.ga>0?`+${row.gf-row.ga}`:row.gf-row.ga}</span><b>{row.points}</b><span className="form-result-badge">{Array.from({length:5},(_,i)=>recentForm(row.id,now)[i]??null).map((result,i)=>result?<i className="form-result-dot" data-result={result} key={i}>{result==="W"?"G":result==="D"?"B":"M"}</i>:<i className="form-result-missing" key={i}>—</i>)}</span></div>})}</div></section></> : null}
      <footer className={styles.footer}><b data-no-translate>WINIQ</b><span>Bu ekran yalnızca bilgi sunar; kullanıcı kendi kararını verir.</span></footer>
    </div>
  </main>;
}
