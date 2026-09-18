import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ACTIVE_SEASON_YEAR, isDateInSeason } from "@/config/season";
import { requireAdmin } from "@/lib/auth-session";
import { loadDashboardPredictions } from "@/lib/prediction-dashboard";
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

export default async function SpecialPage({searchParams}:{searchParams?:Promise<{range?:string;market?:string;sortDate?:string;sortProb?:string;sortOdds?:string;minProb?:string;maxProb?:string}>}){
  await requireAdmin();
  const q=await searchParams;
  const range=q?.range==="week"?"week":"day";
  const market=q?.market||"ALL";
  const sortDate=q?.sortDate==="1";
  const sortProb=q?.sortProb==="1";
  const sortOdds=q?.sortOdds==="1";
  const minProb=q?.minProb?Number(q.minProb):null;
  const maxProb=q?.maxProb?Number(q.maxProb):null;
  const now=new Date();
  const dayKey=(value:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
  const todayKey=dayKey(now);
  const end=new Date(now.getTime()+(range==="week"?7:1)*86400000);

  // Önce canlı veritabanından güncel maçlar alınır (sitenin diğer
  // tahmin sayfalarıyla paylaşılan, önbellekli canlı hesaplama
  // motoru). Canlı hesaplama başarısız olursa veya boş dönerse
  // önceden üretilmiş snapshot'a geri düşülür.
  let all:DashboardPrediction[];
  let dataSource:"LIVE"|"SNAPSHOT"="LIVE";
  try{
    const live=await loadDashboardPredictions(10000);
    if(live.length===0) throw new Error("Canlı veri boş döndü.");
    all=live;
  }catch{
    dataSource="SNAPSHOT";
    all=await loadDashboardPredictionSnapshot(10000);
  }

  const rawMatches=all.filter(p=>isDateInSeason(p.kickoffAt,ACTIVE_SEASON_YEAR)&&(range==="day"?dayKey(p.kickoffAt)===todayKey:p.kickoffAt<end&&p.kickoffAt>=now)&&(p.settlementStatus===undefined||p.settlementStatus==="PENDING"));
  const occupied=new Set<string>(); const seenMatchIds=new Set<number>();
  // Not: homeTeamId/awayTeamId alanları DashboardPrediction tipinde
  // opsiyonel olduğu için (ve bazı dağıtım/deploy senaryolarında bu
  // alanları ekleyen paylaşılan tip dosyası güncellenmemiş olabilir),
  // burada güvenli bir runtime erişimi kullanılıyor — tip tanımı eksik
  // olsa bile derleme hatası vermez, sadece isim bazlı eşleştirmeye
  // geri düşer.
  const teamKey=(p:DashboardPrediction,side:"home"|"away")=>{const record=p as DashboardPrediction & {homeTeamId?:number|null;awayTeamId?:number|null}; const id=side==="home"?record.homeTeamId:record.awayTeamId; if(id!=null) return `id:${id}`; return `name:${(side==="home"?p.homeTeam:p.awayTeam).trim().toLocaleLowerCase("tr-TR")}`;};
  const matches=[...rawMatches].sort((a,b)=>b.confidenceScore-a.confidenceScore).filter(p=>{if(seenMatchIds.has(p.matchId)) return false; const day=dayKey(p.kickoffAt);const teams=[teamKey(p,"home"),teamKey(p,"away")];if(teams.some(t=>occupied.has(`${day}|${t}`))) return false;seenMatchIds.add(p.matchId);teams.forEach(t=>occupied.add(`${day}|${t}`));return true;});

  const marketMap=new Map<string,string>([["DRAW","Beraberlik (X)"]]);
  for(const p of matches) for(const row of [...(p.popularMarketsSummary??[]),...(p.topPicks??[])]) if(row.market) marketMap.set(row.market,readableMarket(row.market,"label" in row ? row.label : row.market));

  const candidates=matches.flatMap(p=>{
    const make=(marketKey:string,label:string,selection:string,probability:number,fairOdds:number|null)=>({p,marketLabel:readableMarket(marketKey,label),selection:readableSelection(marketKey,selection,p.homeTeam,p.awayTeam),prob:probability,odds:fairOdds??(probability?100/probability:0)});
    // Beraberlik seçimi yalnızca kullanıcı özellikle "Beraberlik (X)"
    // seçtiğinde listelenir — "Tüm bahisler" görünümüne otomatik
    // eklenmez.
    if(market==="DRAW") return p.drawProbability>0?[make("DRAW","Beraberlik (X)","DRAW",p.drawProbability,null)]:[];
    const source=[...(p.popularMarketsSummary??[]),...(p.topPicks??[])].filter(x=>(!('supported' in x)||x.supported!==false)&&typeof x.probability==="number"&&x.market);
    const selected=market==="ALL"?source:[source.find(x=>x.market===market)].filter(Boolean);
    const unique=new Map<string,typeof source[number]>();
    for(const x of selected){if(!x?.market) continue; const key=`${x.market}|${x.selection??('label' in x?x.label:x.market)}`; if(!unique.has(key)||(x.probability??0)>(unique.get(key)?.probability??0)) unique.set(key,x);}
    return [...unique.values()].map(x=>make(x.market!,('label' in x?x.label:x.market!),x.selection??('label' in x?x.label:x.market!),x.probability!,x.fairOdds??null));
  }).filter(x=>x.prob>0&&(minProb==null||x.prob>=minProb)&&(maxProb==null||x.prob<=maxProb));

  // Sıralama: kullanıcı tarih/olasılık/adil oran kutucuklarından
  // istediği kadarını işaretleyebilir; seçilen kriterler bu sırayla
  // (tarih → olasılık → adil oran) birbirini tamamlayan bir sıralama
  // oluşturur. Hiçbiri seçilmezse varsayılan: en yüksek olasılıktan
  // düşüğe.
  const sortStages:((a:typeof candidates[number],b:typeof candidates[number])=>number)[]=[];
  if(sortDate) sortStages.push((a,b)=>a.p.kickoffAt.getTime()-b.p.kickoffAt.getTime());
  if(sortProb) sortStages.push((a,b)=>b.prob-a.prob);
  if(sortOdds) sortStages.push((a,b)=>a.odds-b.odds);
  if(sortStages.length===0) sortStages.push((a,b)=>b.prob-a.prob);
  candidates.sort((a,b)=>{for(const compare of sortStages){const result=compare(a,b); if(result!==0) return result;} return 0;});

  const rows=candidates.map((x,i)=><article className={styles.row} key={`${x.p.matchId}-${x.marketLabel}-${x.selection}`}><b className={styles.rank}>{i+1}</b><div className={styles.meta}><small>{x.p.leagueName}</small><time>{dt(x.p.kickoffAt)}</time></div><div className={styles.teams}><span><Logo src={x.p.homeTeamLogo} name={x.p.homeTeam}/><strong>{x.p.homeTeam}</strong></span><i>VS</i><span><Logo src={x.p.awayTeamLogo} name={x.p.awayTeam}/><strong>{x.p.awayTeam}</strong></span></div><div className={styles.tier} data-tier={tier(x.p)}>{tier(x.p)}</div><div className={styles.prob}><small>Olasılık</small><strong>%{x.prob.toFixed(1)}</strong><i><b style={{width:`${x.prob}%`}}/></i></div><div className={styles.odds}><small>{x.marketLabel}</small><strong>{x.odds.toFixed(2)}</strong><small>{x.selection}</small></div></article>);
  const selectedTitle=market==="ALL"?"Tüm bahisler · sıralama seçimlerinize göre":marketMap.get(market)||market;

  return <PageShell><main className={styles.page}>
    <header className={styles.hero}><div><p>WINIQ · SPECIAL LIST</p><h1>Special List</h1><span>Seçilen bahis türünde en yüksek olasılıklı maçlar.</span></div><strong>{candidates.length} seçim</strong></header>
    <section className={styles.controls}>
      <div className={styles.controlHeading}><div><span className={styles.eyebrow}>FİLTRELE VE KEŞFET</span><h2>Maç aralığını seçin</h2></div><span className={styles.liveDot} data-source={dataSource}><i/> {dataSource==="LIVE"?"Canlı veri":"Snapshot (yedek veri)"}</span></div>
      <nav className={styles.range}>
        <Link data-active={range==="day"} href={`/special?range=day&market=${market}${sortDate?"&sortDate=1":""}${sortProb?"&sortProb=1":""}${sortOdds?"&sortOdds=1":""}${minProb!=null?`&minProb=${minProb}`:""}${maxProb!=null?`&maxProb=${maxProb}`:""}`}><span className={styles.tabIcon}>◷</span><span>Bugünün maçları</span><small>Bugün</small></Link>
        <Link data-active={range==="week"} href={`/special?range=week&market=${market}${sortDate?"&sortDate=1":""}${sortProb?"&sortProb=1":""}${sortOdds?"&sortOdds=1":""}${minProb!=null?`&minProb=${minProb}`:""}${maxProb!=null?`&maxProb=${maxProb}`:""}`}><span className={styles.tabIcon}>▦</span><span>Haftanın maçları</span><small>7 günlük görünüm</small></Link>
      </nav>
      <form className={styles.marketSelect}>
        <label><span className={styles.labelTop}><span className={styles.targetIcon}>◎</span><span>Bahis türü</span></span><span className={styles.selectWrap}><select name="market" defaultValue={market}><option value="ALL">Tüm bahisler · en yüksek olasılık</option><option value="DRAW">Beraberlik (X)</option>{[...marketMap].filter(([k])=>k!=="DRAW").map(([k,v])=><option value={k} key={k}>{v}</option>)}</select><span>⌄</span></span></label>
        <input type="hidden" name="range" value={range}/>
        <label className={styles.rangeField}><span>Min. olasılık %</span><input type="number" name="minProb" min={0} max={100} step={1} defaultValue={minProb??""} placeholder="0"/></label>
        <label className={styles.rangeField}><span>Maks. olasılık %</span><input type="number" name="maxProb" min={0} max={100} step={1} defaultValue={maxProb??""} placeholder="100"/></label>
        <button><span>Listele</span><b>→</b></button>
        <fieldset className={styles.sortFieldset}>
          <legend>Sıralama (birden fazla seçilebilir)</legend>
          <label><input type="checkbox" name="sortDate" value="1" defaultChecked={sortDate}/><span>Tarihe göre</span></label>
          <label><input type="checkbox" name="sortProb" value="1" defaultChecked={sortProb}/><span>Olasılığa göre</span></label>
          <label><input type="checkbox" name="sortOdds" value="1" defaultChecked={sortOdds}/><span>Adil orana göre</span></label>
        </fieldset>
      </form>
      <p className={styles.helper}>Hiçbir sıralama seçilmezse sonuçlar en yüksek olasılıktan düşüğe sıralanır. Birden fazla sıralama seçilirse sırasıyla tarih → olasılık → adil oran önceliğiyle uygulanır.</p>
    </section>
    <section className={styles.panel}>
      <header><div><h2>{selectedTitle}</h2><p>Seçim, olasılık ve adil oran bilgileri</p></div><span>{sortDate||sortProb||sortOdds?[sortDate&&"Tarih",sortProb&&"Olasılık",sortOdds&&"Adil oran"].filter(Boolean).join(" → "):"Olasılık sıralaması"}</span></header>
      <div className={styles.list}>{rows.length?rows:<div className={styles.empty}>Bu bahis türünde seçilen dönem için sonuç bulunamadı.</div>}</div>
    </section>
    <footer>WINIQ · Sadece listeleme ekranı</footer>
  </main></PageShell>;
}
