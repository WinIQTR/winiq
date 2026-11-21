import Link from "next/link";

import styles from "./member-shortlist-tabs.module.css";

export function MemberShortlistTabs({
  active,
}: {
  active: "special" | "value";
}) {
  return (
    <nav className={styles.tabs} aria-label="Shortlists">
      <Link
        className={styles.tab}
        data-active={active === "special" ? "true" : undefined}
        href="/member/professional/special"
      >
        Special List
      </Link>
      <Link
        className={styles.tab}
        data-active={active === "value" ? "true" : undefined}
        href="/member/value"
      >
        Value opportunities
      </Link>
    </nav>
  );
}
