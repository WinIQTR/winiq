import { LoginForm } from "@/components/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-language"><LanguageSwitcher /></div>
        <div className="login-mark">AI</div>
        <p className="member-eyebrow">WINIQ</p>
        <h1>Üye girişi</h1>
        <p>Günlük futbol tahminlerinize güvenli biçimde ulaşın.</p>
        <LoginForm />
        <small>Kayıtlar yönetici onayıyla oluşturulur. Açık üyelik kapalıdır.</small>
      </section>
    </main>
  );
}
