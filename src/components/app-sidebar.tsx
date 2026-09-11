import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";

const items = [
  {
    href: "/admin-dashboard",
    label: "Dashboard",
  },

  {
    href: "/predictions",
    label: "Predictions",
  },

  {
    href: "/prediction-results",
    label: "Prediction Results",
  },

  {
    href: "/match-result-performance",
    label: "Market Performance",
  },

  {
    href: "/coupons",
    label: "Smart Coupons",
  },

  {
    href: "/coupon-performance",
    label: "Coupon Performance",
  },

  {
    href: "/smart-picks",
    label: "Smart Picks",
  },

  {
    href: "/evaluation",
    label: "Model Performance",
  },

  {
    href: "/fixtures",
    label: "Fixtures",
  },

  {
    href: "/teams",
    label: "Teams",
  },

  {
    href: "/players",
    label: "Players",
  },

  {
    href: "/top-scorers",
    label: "Top Scorers",
  },

  {
    href: "/admin",
    label: "Admin",
  },

  {
    href: "/admin/members",
    label: "Members",
  },

  {
    href: "/admin/messages",
    label: "Member Messages",
  },

  {
    href: "/admin/data-coverage",
    label: "Data Coverage",
  },

  {
    href: "/settings",
    label: "Settings",
  },
];

export function AppSidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <div className="brand-mark">
            AI
          </div>

          <div>
            <strong>
              WINIQ
            </strong>

            <span>
              AI Futbol Merkezi
            </span>
          </div>
        </div>

        <nav className="nav">
          {items.map(
            (
              item,
              index,
            ) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
              >
                <span>
                  {String(
                    index + 1,
                  ).padStart(
                    2,
                    "0",
                  )}
                </span>

                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="sidebar-language">
          <LanguageSwitcher />
        </div>
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
