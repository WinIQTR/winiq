import Link from "next/link";
import { ACTIVE_COMPETITIONS } from "@/config/competitions";
import styles from "@/app/football-data.module.css";

export function FootballDirectoryNav({ pathname, selected }: { pathname: string; selected: number }) {
  return <nav className={styles.leagues} aria-label="Organizasyon seçimi">
    {ACTIVE_COMPETITIONS.map((item) => <Link
      key={item.apiId}
      href={`${pathname}?league=${item.apiId}`}
      className={item.apiId === selected ? styles.leagueActive : styles.league}
    ><strong>{item.shortName}</strong><span>{item.name}</span></Link>)}
  </nav>;
}
