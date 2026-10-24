import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

type NavItem = { href: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Live",
    items: [
      { href: "/admin-dashboard", label: "Dashboard" },
      { href: "/predictions", label: "Predictions" },
      { href: "/special", label: "Special list" },
      { href: "/value-bets", label: "Value bets" },
    ],
  },
  {
    title: "Performance",
    items: [
      { href: "/prediction-results", label: "Prediction results" },
      { href: "/match-result-performance", label: "Market performance" },
      { href: "/coupons", label: "Coupon centre" },
      { href: "/evaluation", label: "Model Performance" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/fixtures", label: "Fixtures" },
      { href: "/teams", label: "Teams" },
      { href: "/players", label: "Players" },
      { href: "/top-scorers", label: "Top scorers" },
      { href: "/admin/data-coverage", label: "Data coverage" },
      { href: "/operations", label: "Operations" },
    ],
  },
  {
    title: "Membership",
    items: [
      { href: "/admin/members", label: "Members" },
      { href: "/admin/messages", label: "Inbox" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin", label: "System health" },
      { href: "/admin-dashboard/mobile", label: "Mobile preview" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function AppSidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <div className="brand-mark" data-no-translate>
            W
          </div>
          <div>
            <strong data-no-translate>WINIQ</strong>
            <span>Admin centre</span>
          </div>
        </div>

        <nav className="nav admin-nav-groups">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-group-title">{group.title}</p>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="nav-item">
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="status-dot" />
          System online
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
