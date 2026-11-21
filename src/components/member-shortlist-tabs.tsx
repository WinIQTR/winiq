import Link from "next/link";

import styles from "./member-shortlist-tabs.module.css";

export function MemberShortlistTabs({
  active,
}: {
  active: "special" | "value";
}) {
  return (
    <nav className={styles.tabs} aria-label="Kısa listeler">
      <Link
        className={styles.tab}
        data-active={active === "special" ? "true" : undefined}
        href="/member/professional/special"
      >
        Özel liste
      </Link>
      <Link
        className={styles.tab}
        data-active={active === "value" ? "true" : undefined}
        href="/member/value"
      >
        Değer fırsatları
      </Link>
    </nav>
  );
}
