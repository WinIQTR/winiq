import "dotenv/config";
import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import { ACTIVE_SEASON_YEAR } from "@/config/season";
import { prisma } from "@/lib/prisma";
import { importTeamsFromApiFootball } from "@/modules/importer/football/api-football/import-teams";
import { importFixturesFromApiFootball } from "@/modules/importer/football/api-football/import-fixtures";
import { importPlayersFromApiFootball } from "@/modules/importer/football/api-football/import-players";
import { importInjuriesFromApiFootball } from "@/modules/importer/football/api-football/import-injuries";
import { importMatchTeamStatistics } from "@/modules/importer/football/api-football/import-match-team-statistics";
import { importPlayerMatchPerformances } from "@/modules/importer/football/api-football/import-player-match-performances";

const integer=(value:string|undefined,fallback:number)=>{const n=Number.parseInt(value??"",10);return Number.isInteger(n)&&n>0?n:fallback};
async function main(){
 const budget=integer(process.env.FOOTBALL_DATA_MAX_REQUESTS,1200);const recentMatches=integer(process.env.FOOTBALL_DATA_RECENT_MATCHES,20);let used=0;
 const competitions=[...ACTIVE_COMPETITIONS].sort((a,b)=>a.priority-b.priority);
 console.log("\n==============================================\nPRO FOOTBALL DATA CENTER REFRESH\n==============================================");
 console.table({Sezon:ACTIVE_SEASON_YEAR,"API bütçesi":budget,"Öncelik 1":"Takımlar + fikstürler","Öncelik 2":"Oyuncu sezon verileri","Öncelik 3":"Eksikler + maç istatistikleri"});
 if(process.env.CONFIRM_FOOTBALL_DATA_REFRESH!=="YES"){console.log('\nGüvenli durdurma. PowerShell: $env:CONFIRM_FOOTBALL_DATA_REFRESH = "YES"');console.log("Ardından: pnpm run data:refresh-pro-v9");return}
 const summary:Array<Record<string,string|number>>=[];
 for(const c of competitions){try{const teams=await importTeamsFromApiFootball(c.apiId,ACTIVE_SEASON_YEAR);used++;const fixtures=await importFixturesFromApiFootball(c.apiId,ACTIVE_SEASON_YEAR);used++;summary.push({Öncelik:1,Lig:c.name,Veri:"Takım + fikstür",Alınan:teams.teamsReceived+fixtures.fixturesReceived,"API isteği":2,Durum:"TAMAM"})}catch(error){summary.push({Öncelik:1,Lig:c.name,Veri:"Takım + fikstür",Alınan:0,"API isteği":0,Durum:error instanceof Error?`UYARI: ${error.message}`:"UYARI"})}}
 for(const c of competitions){if(used>=budget)break;try{const result=await importPlayersFromApiFootball(c.apiId,ACTIVE_SEASON_YEAR);used+=result.apiRequests;summary.push({Öncelik:2,Lig:c.name,Veri:"Oyuncular",Alınan:result.uniquePlayers,"API isteği":result.apiRequests,Durum:result.teamsReachedPageLimit.length?"SAYFA SINIRI":"TAMAM"})}catch(error){summary.push({Öncelik:2,Lig:c.name,Veri:"Oyuncular",Alınan:0,"API isteği":0,Durum:error instanceof Error?`UYARI: ${error.message}`:"UYARI"})}}
 for(const c of competitions){if(used>=budget)break;try{const result=await importInjuriesFromApiFootball(c.apiId,ACTIVE_SEASON_YEAR);used+=result.apiRequests;summary.push({Öncelik:3,Lig:c.name,Veri:"Sakatlık / eksik",Alınan:result.rowsReceived,"API isteği":result.apiRequests,Durum:"TAMAM"})}catch(error){summary.push({Öncelik:3,Lig:c.name,Veri:"Sakatlık / eksik",Alınan:0,"API isteği":0,Durum:error instanceof Error?`UYARI: ${error.message}`:"UYARI"})}}
 for(const c of competitions){if(used>=budget)break;try{const allowed=Math.max(1,Math.min(recentMatches,budget-used));const result=await importMatchTeamStatistics({leagueApiId:c.apiId,seasonYear:ACTIVE_SEASON_YEAR,maximumMatches:allowed,refreshIncomplete:true});used+=result.apiRequests;summary.push({Öncelik:3,Lig:c.name,Veri:"Maç takım istatistiği",Alınan:result.teamStatisticsSaved,"API isteği":result.apiRequests,Durum:result.stoppedByDailyLimit||result.stoppedByRateLimit?"LİMİTTE DURDU":"TAMAM"})}catch(error){summary.push({Öncelik:3,Lig:c.name,Veri:"Maç takım istatistiği",Alınan:0,"API isteği":0,Durum:error instanceof Error?`UYARI: ${error.message}`:"UYARI"})}}
 if(process.env.FOOTBALL_DATA_PLAYER_MATCHES==="YES")for(const c of competitions){if(used>=budget)break;try{const allowed=Math.max(1,Math.min(5,budget-used));const result=await importPlayerMatchPerformances({leagueApiId:c.apiId,seasonYear:ACTIVE_SEASON_YEAR,maximumMatches:allowed,requestDelayMs:500});used+=result.apiRequests;summary.push({Öncelik:4,Lig:c.name,Veri:"Oyuncu maç performansı",Alınan:result.performancesSaved,"API isteği":result.apiRequests,Durum:"TAMAM"})}catch(error){summary.push({Öncelik:4,Lig:c.name,Veri:"Oyuncu maç performansı",Alınan:0,"API isteği":0,Durum:error instanceof Error?`UYARI: ${error.message}`:"UYARI"})}}
 console.log("\n==============================================\nPRO DATA REFRESH SUMMARY\n==============================================");console.table(summary);console.log(`Kullanılan istek: ${used}/${budget}`);console.log("Not: API'nin ilgili maç/lig için sunmadığı alanlar uydurulmaz; arayüzde '–' olarak gösterilir.");
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
