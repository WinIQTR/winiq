import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";

type NavItem = { href: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Canlı",
    items: [
      { href: "/admin-dashboard", label: "Kontrol paneli" },
      { href: "/predictions", label: "Tahminler" },
      { href: "/special", label: "Özel liste" },
      { href: "/value-bets", label: "Değer bahisleri" },
    ],
  },
  {
    title: "Performans",
    items: [
      { href: "/prediction-results", label: "Tahmin sonuçları" },
      { href: "/match-result-performance", label: "Pazar performansı" },
      { href: "/coupons", label: "Kupon merkezi" },
      { href: "/coupon-performance", label: "Kupon performansı" },
      { href: "/evaluation", label: "Model performansı" },
    ],
  },
  {
    title: "Veri",
    items: [
      { href: "/fixtures", label: "Fikstür" },
      { href: "/teams", label: "Takımlar" },
      { href: "/players", label: "Oyuncular" },
      { href: "/top-scorers", label: "Gol krallığı" },
      { href: "/admin/data-coverage", label: "Veri kapsamı" },
      { href: "/operations", label: "Operasyon" },
    ],
  },
  {
    title: "Üyelik",
    items: [
      { href: "/admin/members", label: "Üyeler" },
      { href: "/admin/messages", label: "Gelen kutusu" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin", label: "Sistem sağlığı" },
      { href: "/admin-dashboard/mobile", label: "Mobil önizleme" },
      { href: "/settings", label: "Ayarlar" },
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
            <span>Yönetim merkezi</span>
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

        <div className="sidebar-language">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="status-dot" />
          Sistem çevrimiçi
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
