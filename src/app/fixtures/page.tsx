import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { FootballDirectoryNav } from "@/components/football-directory-nav";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { prisma } from "@/lib/prisma";
import { firstParam, resolveDirectoryCompetition, trDate, trTime } from "@/lib/football-directory";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { hasHotSupport } from "@/lib/team-display";
import styles from "../football-data.module.css";

type Props = { searchParams: Promise<{ league?: string | string[]; week?: string | string[]; status?: string | string[]; q?: string | string[] }> };
const day = 86_400_000;
function monday(value: Date) { const date = new Date(value); const n = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - n + 1); date.setUTCHours(0,0,0,0); return date; }
function numberParam(value: string | string[] | undefined) { const parsed = Number.parseInt(firstParam(value) ?? "0",10); return Number.isFinite(parsed) ? Math.max(-60,Math.min(60,parsed)) : 0; }
function statusParam(value: string | string[] | undefined) { const status = (firstParam(value) ?? "ALL").toUpperCase(); return ["ALL","UPCOMING","FINISHED"].includes(status) ? status : "ALL"; }
type FormResult = "W" | "D" | "L";

export default async function FixturesPage({ searchParams }: Props) {
  const params = await searchParams;
  const competition = resolveDirectoryCompetition(params.league);
  const offset = numberParam(params.week);
  const selectedStatus = statusParam(params.status);
  const query = (firstParam(params.q) ?? "").trim().toLocaleLowerCase("tr-TR");
  const start = new Date(monday(new Date()).getTime() + offset * 7 * day);
  const end = new Date(start.getTime() + 7 * day);
  const all = await prisma.match.findMany({
    where: { season: { year: ACTIVE_SEASON_YEAR, league: { apiId: competition.apiId } }, kickoffAt: { gte:start, lt:end } },
    orderBy:{kickoffAt:"asc"},
    include:{homeTeam:{select:{name:true,logoUrl:true,venueName:true,venueCapacity:true}},awayTeam:{select:{name:true,logoUrl:true}},teamStatistics:{select:{teamId:true,shots:true,shotsOnTarget:true,possession:true,corners:true,fouls:true,offsides:true,yellowCards:true,redCards:true,expectedGoals:true}}},
  });
  const [history, predictionSnapshot] = await Promise.all([
    prisma.match.findMany({
      where:{season:{year:ACTIVE_SEASON_YEAR,league:{apiId:competition.apiId}},status:"FINISHED",kickoffAt:{lt:end}},
      orderBy:{kickoffAt:"asc"},
      select:{homeTeamId:true,awayTeamId:true,homeScore:true,awayScore:true,kickoffAt:true},
    }),
    loadDashboardPredictionSnapshot(),
  ]);
  const predictionByMatchId=new Map(predictionSnapshot.map(prediction=>[prediction.matchId,prediction]));
  const recentForm=(teamId:number,before:Date):FormResult[]=>history.filter(match=>match.kickoffAt<before&&(match.homeTeamId===teamId||match.awayTeamId===teamId)&&match.homeScore!==null&&match.awayScore!==null).slice(-5).map(match=>{const isHome=match.homeTeamId===teamId;const own=isHome?match.homeScore!:match.awayScore!;const opponent=isHome?match.awayScore!:match.homeScore!;return own>opponent?"W":own<opponent?"L":"D"});
  const matches = all.filter((match) => {
    const text = `${match.homeTeam.name} ${match.awayTeam.name}`.toLocaleLowerCase("tr-TR");
    return (!query || text.includes(query)) && (selectedStatus === "ALL" || (selectedStatus === "FINISHED" ? match.status === "FINISHED" : ["SCHEDULED","LIVE","POSTPONED"].includes(match.status)));
  });
  const finished = all.filter((m) => m.status === "FINISHED").length;
  const upcoming = all.filter((m) => ["SCHEDULED","LIVE","POSTPONED"].includes(m.status)).length;
  const detailed = all.filter((m) => m.teamStatistics.length > 0).length;
  const href = (extra: Record<string,string|number>) => `/fixtures?${new URLSearchParams({league:String(competition.apiId),week:String(offset),status:selectedStatus,...Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,String(v)]))})}`;
  const statusLabel = (status:string, short:string|null) => status === "FINISHED" ? "Bitti" : status === "LIVE" ? `${short ?? "Canlı"}` : status === "POSTPONED" ? "Ertelendi" : status === "CANCELLED" ? "İptal" : "Başlamadı";

  return <PageShell><main className={styles.page}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>FİKSTÜR VERİ MERKEZİ · {ACTIVE_SEASON_YEAR}</p><h1>Maçlar, skorlar ve detaylar</h1><p>Hakem, stat, devre skorları ve çekilebilen maç istatistikleri tek satırda; ayrıntılar ihtiyaç olduğunda açılır.</p></div><div className={styles.fresh}><span><strong>{all.length}</strong> maç</span><span><strong>{detailed}</strong> istatistikli</span></div></header>
    <FootballDirectoryNav pathname="/fixtures" selected={competition.apiId}/>
    <section className={styles.stats}><article className={styles.stat}><span>Bu hafta</span><strong>{all.length}</strong></article><article className={styles.stat}><span>Başlamamış / canlı</span><strong>{upcoming}</strong></article><article className={styles.stat}><span>Sonuçlanan</span><strong>{finished}</strong></article><article className={styles.stat}><span>Detay kapsamı</span><strong>%{all.length ? Math.round(detailed/all.length*100) : 0}</strong></article></section>
    <section className={styles.toolbar}><nav><Link href={href({week:offset-1})}>← Önceki</Link><Link href={href({week:0})} data-active={offset===0}>Bu hafta</Link><Link href={href({week:offset+1})}>Sonraki →</Link></nav><nav>{[["ALL","Tümü"],["UPCOMING","Başlamamış"],["FINISHED","Biten"]].map(([key,label])=><Link key={key} href={href({status:key})} data-active={selectedStatus===key}>{label}</Link>)}</nav><form action="/fixtures"><input type="hidden" name="league" value={competition.apiId}/><input type="hidden" name="week" value={offset}/><input type="hidden" name="status" value={selectedStatus}/><input className={styles.search} name="q" defaultValue={firstParam(params.q)} placeholder="Takım ara…"/></form></section>
    <section className={styles.panel}><header className={styles.panelHead}><h2>{trDate(start)} – {trDate(new Date(end.getTime()-day))}</h2><span className={styles.badge}>{competition.name}</span></header><div className={styles.rows}>
      {matches.length===0?<div className={styles.empty}>Bu filtrede maç bulunamadı.</div>:matches.map((match)=>{
        const homeStat=match.teamStatistics.find(s=>s.teamId===match.homeTeamId); const awayStat=match.teamStatistics.find(s=>s.teamId===match.awayTeamId);
        const prediction=predictionByMatchId.get(match.id);const homeForm=prediction?.homeRecentResults??recentForm(match.homeTeamId,match.kickoffAt);const awayForm=prediction?.awayRecentResults??recentForm(match.awayTeamId,match.kickoffAt);const favorite=prediction?.predictedOutcome??null;const favoriteProbability=prediction?.predictedProbability??null;const venue=match.venueName??match.homeTeam.venueName??"Stat bekleniyor";
        return <article className={styles.match} key={match.id}><div className={styles.meta}><strong>{trDate(match.kickoffAt)} · {trTime(match.kickoffAt)}</strong><span>{match.round ?? "Tur bilgisi yok"}</span></div><div className={styles.teams}><div className={styles.team}>{match.homeTeam.logoUrl?<Image src={match.homeTeam.logoUrl} alt="" width={24} height={24}/>:<span/>}<strong>{match.homeTeam.name} {hasHotSupport(match.homeTeam.name)?<span className={styles.hotFans} title="Taraftar atmosferiyle öne çıkan kulüp">🔥</span>:null} {favorite==="HOME"?<span className={styles.favorite} title={`Model favorisi${favoriteProbability!==null?` · %${Math.round(favoriteProbability)}`:""}`}>★</span>:null}</strong><span className={styles.form}>{homeForm.map((result,index)=><i data-result={result} key={index}>{result}</i>)}</span><b className={styles.score}>{match.homeScore ?? "–"}</b></div><div className={styles.team}>{match.awayTeam.logoUrl?<Image src={match.awayTeam.logoUrl} alt="" width={24} height={24}/>:<span/>}<strong>{match.awayTeam.name} {hasHotSupport(match.awayTeam.name)?<span className={styles.hotFans} title="Taraftar atmosferiyle öne çıkan kulüp">🔥</span>:null} {favorite==="AWAY"?<span className={styles.favorite} title={`Model favorisi${favoriteProbability!==null?` · %${Math.round(favoriteProbability)}`:""}`}>★</span>:null}</strong><span className={styles.form}>{awayForm.map((result,index)=><i data-result={result} key={index}>{result}</i>)}</span><b className={styles.score}>{match.awayScore ?? "–"}</b></div><span className={styles.favoriteNote}>{favorite==="DRAW"?`◆ Beraberlik önde${favoriteProbability!==null?` · %${Math.round(favoriteProbability)}`:""}`:favorite?"★ Model favorisi":"Favori verisi bekleniyor"}</span></div><span className={`${styles.status} ${match.status==="LIVE"?styles.live:match.status==="FINISHED"?styles.done:""}`}>{statusLabel(match.status,match.statusShort)}</span><div className={styles.meta}><span>{venue}{match.homeTeam.venueCapacity?` · ${match.homeTeam.venueCapacity.toLocaleString("tr-TR")} kişi`:""}</span><span>{match.referee ?? "Hakem bekleniyor"}</span></div>
        <details className={styles.detail}><summary>Tüm maç verisini göster</summary><div className={styles.detailGrid}><div><span>İlk yarı</span><strong>{match.halfTimeHomeScore ?? "–"} – {match.halfTimeAwayScore ?? "–"}</strong></div><div><span>Uzatma / penaltı</span><strong>{match.extraTimeHomeScore ?? "–"}–{match.extraTimeAwayScore ?? "–"} / {match.penaltyHomeScore ?? "–"}–{match.penaltyAwayScore ?? "–"}</strong></div><div><span>Şut</span><strong>{homeStat?.shots ?? "–"} – {awayStat?.shots ?? "–"}</strong></div><div><span>İsabetli şut</span><strong>{homeStat?.shotsOnTarget ?? "–"} – {awayStat?.shotsOnTarget ?? "–"}</strong></div><div><span>Korner</span><strong>{homeStat?.corners ?? "–"} – {awayStat?.corners ?? "–"}</strong></div><div><span>Topa sahip olma</span><strong>{homeStat?.possession ?? "–"}% – {awayStat?.possession ?? "–"}%</strong></div><div><span>Ofsayt</span><strong>{homeStat?.offsides ?? "–"} – {awayStat?.offsides ?? "–"}</strong></div><div><span>Faul</span><strong>{homeStat?.fouls ?? "–"} – {awayStat?.fouls ?? "–"}</strong></div><div><span>Kart (S/K)</span><strong>{homeStat?.yellowCards ?? "–"}/{homeStat?.redCards ?? "–"} – {awayStat?.yellowCards ?? "–"}/{awayStat?.redCards ?? "–"}</strong></div><div><span>xG</span><strong>{homeStat?.expectedGoals ?? "–"} – {awayStat?.expectedGoals ?? "–"}</strong></div><div><span>Şehir</span><strong>{match.venueCity ?? "–"}</strong></div><div><span>API maç ID</span><strong>{match.apiId}</strong></div></div></details></article>})}
    </div></section>
  </main></PageShell>;
}
