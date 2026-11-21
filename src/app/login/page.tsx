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
        <h1>Member login</h1>
        <p>Securely access your daily football predictions.</p>
        <LoginForm />
        <small>Accounts are created with administrator approval. Public registration is disabled.</small>
      </section>
    </main>
  );
}
