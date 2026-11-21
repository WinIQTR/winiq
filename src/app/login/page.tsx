import Image from "next/image";

import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/components/login-form";

import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden>
        <Image
          className={styles.backdropImage}
          src="/brand/login-stadium.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.backdropScrim} />
      </div>

      <section className={styles.card}>
        <div className={styles.language}>
          <LanguageSwitcher />
        </div>

        <div className={styles.brand}>
          <div className={styles.mark} data-no-translate>
            W
          </div>
          <p className={styles.brandName} data-no-translate>
            WINIQ
          </p>
          <span className={styles.brandRule} aria-hidden />
        </div>

        <h1 className={styles.title}>Member login</h1>
        <p className={styles.lede}>Securely access your daily football predictions.</p>

        <LoginForm className={styles.form} submitClassName={styles.submit} errorClassName={styles.error} />

        <small className={styles.footnote}>
          Accounts are created with administrator approval. Public registration is disabled.
        </small>
      </section>
    </main>
  );
}
