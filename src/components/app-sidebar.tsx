import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { href: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

/** Slim admin nav — clutter cut list. Deep links still work if bookmarked. */
const groups: NavGroup[] = [
  {
    title: "Live",
    items: [
      { href: "/predictions", label: "Predictions" },
      { href: "/special", label: "Shortlists" },
      { href: "/coupons", label: "Coupon centre" },
    ],
  },
  {
    title: "Performance",
    items: [{ href: "/evaluation", label: "Performance" }],
  },
  {
    title: "Ops",
    items: [
      { href: "/operations", label: "Operations" },
      { href: "/admin/data", label: "Data centre" },
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
    items: [{ href: "/settings", label: "Settings" }],
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
        <div
          className="sidebar-utilities"
          style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}
        >
          <ThemeToggle />
          <LanguageSwitcher hideLabel />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
