import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import { requireAdmin } from "@/lib/auth-session";
import { loadDashboardPredictionSnapshot } from "@/lib/prediction-dashboard-snapshot";
import type { DashboardPrediction } from "@/lib/prediction-dashboard-shared";
import styles from "./special.module.css";
const dt=(d:Date)=>new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Istanbul"}).format(d);
const tier=(p:DashboardPrediction)=>p.confidenceScore>=70?"Güçlü":p.confidenceScore>=55?"Orta":"Zayıf";
const readableSelection=(market:string, selection:string, home:string, away:string) => {
  const value=selection.toUpperCase();
  const side=value === "HOME" ? home : value === "AWAY" ? away : value === "NONE" ? "Gol yok" : selection;
  const line=market.match(/(\d+(?:\.\d+)?)/)?.[1];
  if(/TOTAL_GOALS|TOTAL GOAL|GOL/i.test(market)) return `${value.includes("OVER")||value.includes("ÜST")?"Üst":"Alt"}${line?` ${line} gol`:""}`;
  if(/CORNER|KORNER/i.test(market)) return `${value.includes("OVER")||value.includes("ÜST")?"Üst":"Alt"}${line?` ${line} korner`:""}`;
  if(/CARD|KART/i.test(market)) return `${value.includes("OVER")||value.includes("ÜST")?"Üst":"Alt"}${line?` ${line} kart`:""}`;
  if(/FIRST_GOAL|İLK GOL/i.test(market)) return `İlk gol: ${side}`;
  if(/BTTS|KARŞILIKLI/i.test(market)) return value.includes("YES")||value.includes("EVET")?"Karşılıklı gol: Evet":"Karşılıklı gol: Hayır";
  return side;
};
const readableMarket=(market:string,label:string) => {
  const line=market.match(/(\d+(?:\.\d+)?)/)?.[1];
  if(/TOTAL_GOALS|TOTAL GOAL|GOL/i.test(market)) return `Toplam gol · Alt/Üst${line?` ${line}`:""}`;
  if(/CORNER|KORNER/i.test(market)) return `Toplam korner · Alt/Üst${line?` ${line}`:""}`;
  if(/CARD|KART/i.test(market)) return `Toplam kart · Alt/Üst${line?` ${line}`:""}`;
  return label;
};
function Logo({src,name}:{src:string|null;name:string}){return src?<Image src={src} alt="" width={38} height={38}/>:<span className={styles.logo}>{name.slice(0,2).toUpperCase()}</span>}
export default async function SpecialPage({searchParams}:{searchParams?:Promise<{range?:string;market?:string}>}){
  await requireAdmin(); const q=await searchParams; const range=q?.range==="week"?"week":"day"; const market=q?.market||"DRAW"; const now=new Date(); const end=new Date(now); end.setDate(end.getDate()+(range==="week"?7:1)); const start=range==="week"?now:new Date(now.setHours(0,0,0,0));
  const all=await loadDashboardPredictionSnapshot(10000); const matches=all.filter(p=>isDateInSeason(p.kickoffAt,ACTIVE_SEASON_YEAR)&&p.kickoffAt>=start&&p.kickoffAt<end&&(p.settlementStatus===undefined||p.settlementStatus==="PENDING")); const marketMap=new Map<string,string>([["DRAW","Beraberlik (X)"]]);
  for(const p of matches) for(const row of [...(p.popularMarketsSummary??[]),...(p.topPicks??[])]) if(row.market) marketMap.set(row.market,readableMarket(row.market,"label" in row ? row.label : row.market));
  const candidates=matches.flatMap(p=>{
    const make=(marketKey:string,label:string,selection:string,probability:number,fairOdds:number|null)=>({p,marketLabel:readableMarket(marketKey,label),selection:readableSelection(marketKey,selection,p.homeTeam,p.awayTeam),prob:probability,odds:fairOdds??(probability?100/probability:0)});
    if(market==="DRAW") return p.drawProbability>0?[make("DRAW","Beraberlik (X)","DRAW",p.drawProbability,null)]:[];
    const source=[...(p.popularMarketsSummary??[]),...(p.topPicks??[])].filter(x=>(!('supported' in x)||x.supported!==false)&&typeof x.probability==="number"&&x.market);
    if(market==="ALL" && p.drawProbability>0) source.push({market:"DRAW",label:"Beraberlik (X)",selection:"DRAW",probability:p.drawProbability,fairOdds:null,supported:true} as typeof source[number]);
    const selected=market==="ALL"?source:[source.find(x=>x.market===market)].filter(Boolean);
    const unique=new Map<string,typeof source[number]>();
    for(const x of selected){if(!x?.market) continue; const key=`${x.market}|${x.selection??('label' in x?x.label:x.market)}`; if(!unique.has(key)||(x.probability??0)>(unique.get(key)?.probability??0)) unique.set(key,x);}
    return [...unique.values()].map(x=>make(x.market!,('label' in x?x.label:x.market!),x.selection??('label' in x?x.label:x.market!),x.probability!,x.fairOdds??null));
  }).filter(x=>x.prob>0).sort((a,b)=>b.prob-a.prob);
  const rows=candidates.map((x,i)=><article className={styles.row} key={`${x.p.matchId}-${x.marketLabel}-${x.selection}`}><b className={styles.rank}>{i+1}</b><div className={styles.meta}><small>{x.p.leagueName}</small><time>{dt(x.p.kickoffAt)}</time></div><div className={styles.teams}><span><Logo src={x.p.homeTeamLogo} name={x.p.homeTeam}/><strong>{x.p.homeTeam}</strong></span><i>VS</i><span><Logo src={x.p.awayTeamLogo} name={x.p.awayTeam}/><strong>{x.p.awayTeam}</strong></span></div><div className={styles.tier} data-tier={tier(x.p)}>{tier(x.p)}</div><div className={styles.prob}><small>Olasılık</small><strong>%{x.prob.toFixed(1)}</strong><i><b style={{width:`${x.prob}%`}}/></i></div><div className={styles.odds}><small>{x.marketLabel}</small><strong>{x.odds.toFixed(2)}</strong><small>{x.selection}</small></div></article>);
  const selectedTitle=market==="ALL"?"Tüm bahisler · olasılık sıralaması":marketMap.get(market)||market;
  return <PageShell><main className={styles.page}><header className={styles.hero}><div><p>WINIQ · SPECIAL LIST</p><h1>Special List</h1><span>Seçilen bahis türünde en yüksek olasılıklı maçlar.</span></div><strong>{candidates.length} seçim</strong></header><section className={styles.controls}><div className={styles.controlHeading}><div><span className={styles.eyebrow}>FİLTRELE VE KEŞFET</span><h2>Maç aralığını seçin</h2></div><span className={styles.liveDot}><i/> Canlı veri</span></div><nav className={styles.range}><Link data-active={range==="day"} href={`/special?range=day&market=${market}`}><span className={styles.tabIcon}>◷</span><span>Bugünün maçları</span><small>Bugün</small></Link><Link data-active={range==="week"} href={`/special?range=week&market=${market}`}><span className={styles.tabIcon}>▦</span><span>Haftanın maçları</span><small>7 günlük görünüm</small></Link></nav><form className={styles.marketSelect}><label><span className={styles.labelTop}><span className={styles.targetIcon}>◎</span><span>Bahis türü</span></span><span className={styles.selectWrap}><select name="market" defaultValue={market}><option value="ALL">Tüm bahisler · en yüksek olasılık</option><option value="DRAW">Beraberlik (X)</option>{[...marketMap].filter(([k])=>k!=="DRAW").map(([k,v])=><option value={k} key={k}>{v}</option>)}</select><span>⌄</span></span></label><input type="hidden" name="range" value={range}/><button><span>Listele</span><b>→</b></button></form><p className={styles.helper}>Tüm desteklenen bahis seçimleri, en yüksek olasılıktan aşağı doğru listelenir.</p></section><section className={styles.panel}><header><div><h2>{selectedTitle}</h2><p>Seçim, olasılık ve adil oran bilgileri · yüksekten düşüğe</p></div><span>Olasılık sıralaması</span></header><div className={styles.list}>{rows.length?rows:<div className={styles.empty}>Bu bahis türünde seçilen dönem için sonuç bulunamadı.</div>}</div></section><footer>WINIQ · Sadece listeleme ekranı</footer></main></PageShell>;
}
