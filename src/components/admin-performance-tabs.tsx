import Link from "next/link";

const tabs = [
  { href: "/evaluation", label: "Model" },
  { href: "/match-result-performance", label: "Pazar" },
  { href: "/prediction-results", label: "Sonuç listesi" },
] as const;

export function AdminPerformanceTabs({ active }: { active: "model" | "markets" | "results" }) {
  return (
    <nav
      className="coupon-center-tabs"
      aria-label="Performans sekmeleri"
      style={{ marginBottom: 16 }}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            (active === "model" && tab.href === "/evaluation") ||
            (active === "markets" && tab.href === "/match-result-performance") ||
            (active === "results" && tab.href === "/prediction-results")
              ? "active"
              : ""
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
