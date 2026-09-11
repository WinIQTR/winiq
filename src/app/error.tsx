"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sunucu tarafı loglara düşsün diye konsola yazıyoruz.
    // Not: Burada ayrıca bir hata izleme servisine (Sentry vb.) gönderim
    // yapılmıyor — proje şu an böyle bir entegrasyon içermiyor.
    console.error(error);
  }, [error]);

  return (
    <main className="login-shell">
      <section className="login-card" aria-live="assertive">
        <div className="login-mark">AI</div>
        <p className="member-eyebrow">WINIQ</p>
        <h1>Bir şeyler ters gitti</h1>
        <p>
          Sayfa yüklenirken beklenmedik bir hata oluştu. Sorun devam ederse
          lütfen daha sonra tekrar deneyin.
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={reset}
        >
          Tekrar dene
        </button>
      </section>
    </main>
  );
}
