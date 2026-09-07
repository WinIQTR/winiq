"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "12px",
            background: "#0b1220",
            color: "#e5edf9",
            fontFamily: "sans-serif",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <h1>Uygulama başlatılamadı</h1>
          <p>Beklenmedik bir hata oluştu. Lütfen sayfayı yenileyin.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 17px",
              borderRadius: "13px",
              border: 0,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
