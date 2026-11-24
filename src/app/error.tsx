"use client";

import { useEffect } from "react";

import styles from "./error.module.css";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.shell} data-theme="dark">
      <section className={styles.card} aria-live="assertive">
        <div className={styles.mark} data-no-translate>
          W
        </div>
        <p className={styles.brand} data-no-translate>
          WINIQ
        </p>
        <h1>Bir şeyler ters gitti</h1>
        <p>
          Sayfa yüklenirken beklenmedik bir hata oluştu. Sorun devam ederse
          lütfen daha sonra tekrar deneyin.
        </p>
        <button type="button" className={styles.retry} onClick={reset}>
          Tekrar dene
        </button>
      </section>
    </main>
  );
}
