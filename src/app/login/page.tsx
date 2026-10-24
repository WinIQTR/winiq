import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-language"><LanguageSwitcher /></div>
        <div className="login-mark" data-no-translate>
          W
        </div>
        <p className="member-eyebrow" data-no-translate>
          WINIQ
        </p>
        <h1>Üye girişi</h1>
        <p>Günlük futbol tahminlerinize güvenli biçimde ulaşın.</p>
        <LoginForm />
        <small>Kayıtlar yönetici onayıyla oluşturulur. Açık üyelik kapalıdır.</small>
      </section>
    </main>
  );
}
