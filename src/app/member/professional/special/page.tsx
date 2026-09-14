import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPortalHeader } from "@/components/member-smart-dashboard";
import member from "@/components/member-smart-dashboard.module.css";
import { requireMember } from "@/lib/auth-session";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import styles from "./special-member.module.css";

const date=(v:Date)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Istanbul"}).format(v);
const tier=(v:number)=>v>=70?"Güçlü":v>=55?"Orta":"Zayıf";
const readable=(m:string,r:string,h:string,a:string)=>{const s=r.toUpperCase(),n=m.match(/(\d+(?:\.\d+)?)/)?.[1],side=s==="HOME"?h:s==="AWAY"?a:s==="NONE"?"Gol yok":r;if(/TOTAL|GOL/i.test(m))return `${s.includes("OVER")?"Üst":"Alt"}${n?` ${n} gol`:""}`;if(/CORNER|KORNER/i.test(m))return `${s.includes("OVER")?"Üst":"Alt"}${n?` ${n} korner`:""}`;if(/CARD|KART/i.test(m))return `${s.includes("OVER")?"Üst":"Alt"}${n?` ${n} kart`:""}`;if(/BTTS|KARŞILIKLI/i.test(m))return s.includes("YES")?"Karşılıklı gol: Evet":"Karşılıklı gol: Hayır";return side;};

export default async function ProfessionalSpecialPage({searchParams}:{searchParams?:Promise<{range?:string;market?:string}>}){
  const user=await requireMember(); if(user.plan!=="PROFESSIONAL") redirect("/member/plans");
  const q=await searchParams; const range=q?.range==="week"?"week":"day"; const market=q?.market??"ALL";
  const now=new Date(); const end=new Date(now); end.setDate(end.getDate()+(range==="week"?7:1));
  const data=await loadDashboardPredictionSnapshot(20000); const matches=data.filter(p=>isDateInSeason(p.kickoffAt,ACTIVE_SEASON_YEAR)&&p.kickoffAt>=now&&p.kickoffAt<end&&(p.settlementStatus===undefined||p.settlementStatus==="PENDING"));
  const marketMap=new Map<string,string>([["ALL","Tüm bahisler · en yüksek olasılık"]]);
  for(const p of matches) for(const x of [...(p.popularMarketsSummary??[]),...(p.topPicks??[])]) if(x.market) marketMap.set(x.market,"label" in x?x.label:x.market);
  const rows=matches.flatMap(p=>{
    const source=[...(p.popularMarketsSummary??[]),...(p.topPicks??[])].filter(x=>(!('supported' in x)||x.supported!==false)&&typeof x.probability==="number"&&x.market).filter(x=>market==="ALL"||x.market===market);
    const unique=new Map<string,typeof source[number]>();
    for(const x of source){const key=`${x.market}|${x.selection??("label" in x?x.label:x.market)}`;if(!unique.has(key)||(x.probability??0)>(unique.get(key)?.probability??0))unique.set(key,x);}
    return [...unique.values()].map(x=>({p,market:x.market!,marketName:"label" in x?x.label:x.market!,selection:readable(x.market!,x.selection??("label" in x?x.label:x.market!),p.homeTeam,p.awayTeam),prob:x.probability!,odds:x.fairOdds??100/x.probability!}));
  }).filter(x=>x.prob>0).sort((a,b)=>b.prob-a.prob);
  return <main className={member.shell}><MemberPortalHeader plan={user.plan} active="fixtures"/><div className={member.page}><section className={member.welcome}><div><p><i/> WINIQ · PROFESYONEL VERİ MERKEZİ</p><h1>Special List</h1><span>Admin Special List ile aynı bahis türü ve olasılık sıralaması.</span></div></section><nav className={styles.actions}><Link href="/member/professional">← Veri merkezine dön</Link><strong>{rows.length} seçim</strong></nav><form className={styles.filters}><div><label>Program</label><select name="range" defaultValue={range}><option value="day">Bugünün maçları</option><option value="week">Haftanın maçları</option></select></div><div><label>Bahis türü</label><select name="market" defaultValue={market}>{[...marketMap].map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></div><button>Listele <b>→</b></button></form><section className={styles.panel}><header><div><h2>{marketMap.get(market)||market}</h2><small>{market==="ALL"?"Her satırda bahis türü ayrıca belirtilir.":"Seçilen marketin en güçlü seçimleri"}</small></div><span>{range==="week"?"7 günlük program":"Bugünün maçları"}</span></header><div className={styles.list}>{rows.length?rows.map((x,i)=><article key={`${x.p.matchId}-${x.market}-${x.selection}`}><b>{i+1}</b><small>{x.p.leagueName} · {date(x.p.kickoffAt)}</small><div className={styles.teams}>{x.p.homeTeam} <i>VS</i> {x.p.awayTeam}</div><em data-tier={tier(x.p.confidenceScore)}>{tier(x.p.confidenceScore)}</em><strong>%{x.prob.toFixed(1)}</strong><div className={styles.pick}><span>Bahis türü · Önerilen seçim</span><b>{x.marketName}</b><strong>{x.selection}</strong></div><div className={styles.odds}><span>Adil oran</span><b>{x.odds.toFixed(2)}</b><small>Model olasılığına göre</small></div></article>):<p className={styles.empty}>Bu dönem ve bahis türü için seçim bulunamadı.</p>}</div></section></div></main>;
}
