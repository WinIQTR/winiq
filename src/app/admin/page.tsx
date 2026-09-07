import Link from "next/link";

import { requireAdmin } from "@/lib/auth-session";

import {
  ACTIVE_SEASON_LABEL,
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

const processSteps = [
  {
    name: "Lig ve sezon",
    description:
      `Canlı üretim sezonu ${ACTIVE_SEASON_LABEL} aktif.`,
    status: "Hazır",
  },
  {
    name: "Takımlar",
    description:
      "20 takım veritabanında kayıtlı.",
    status: "Hazır",
  },
  {
    name: "Fikstür",
    description:
      "Seçili test tarih aralığındaki maçlar.",
    status: "Kontrol",
  },
  {
    name: "Özellik üretimi",
    description:
      "Takım formu, derecelendirme, gol ve xG verileri.",
    status: "Hazır",
  },
  {
    name: "Tahmin motoru",
    description:
      "1X2 olasılık ve kalibrasyon sistemi.",
    status: "Hazır",
  },
];

export default async function AdminPage() {
  await requireAdmin();

  const apiFootballConfigured =
    Boolean(
      process.env.API_FOOTBALL_KEY
        ?.trim(),
    );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link className="back-link" href="/admin-dashboard">
            ← Dashboard
          </Link>

          <p className="eyebrow">SYSTEM CONTROL</p>

          <h1>Yönetim paneli</h1>

          <p className="subtitle">
            Veri aktarımı, özellik üretimi ve tahmin
            işlemleri tek merkezden yönetilir.
          </p>
        </div>

        <div className="mode-badge">
          {ACTIVE_SEASON_LABEL} CANLI MOD
        </div>
      </header>

      <section className="admin-grid">
        <article className="admin-card admin-card-large">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                HIZLI İŞLEM
              </p>

              <h2>Tüm sistemi çalıştır</h2>
            </div>

            <span className="system-online">
              Sistem hazır
            </span>
          </div>

          <p className="admin-description">
            Fikstürü kontrol eder, gerekli
            özellikleri üretir ve maç tahminlerini
            günceller.
          </p>

          <button
            className="run-all-button"
            type="button"
          >
            <span>▶</span>
            Verileri güncelle ve tahminleri oluştur
          </button>

          <div className="run-note">
            Demo arayüzünde bu düğme henüz gerçek
            betiği çalıştırmaz. Sonraki aşamada API
            rotasına bağlanacaktır.
          </div>
        </article>

        <article className="admin-card">
          <p className="eyebrow">AKTİF AYARLAR</p>

          <h2>Veri seçimi</h2>

          <label className="field">
            <span>Lig</span>

            <select defaultValue="39">
              <option value="39">
                Premier League
              </option>
            </select>
          </label>

          <label className="field">
            <span>Sezon</span>

            <select defaultValue={String(ACTIVE_SEASON_YEAR)}>
              <option value={String(ACTIVE_SEASON_YEAR)}>
                {ACTIVE_SEASON_LABEL} — Aktif sezon
              </option>
            </select>
          </label>

          <label className="field">
            <span>Çalışma modu</span>

            <select defaultValue="live">
              <option value="live">
                Canlı üretim modu
              </option>
            </select>
          </label>
        </article>

        <article className="admin-card">
          <p className="eyebrow">BAĞLANTILAR</p>

          <h2>Sistem durumu</h2>

          <div className="status-list">
            <div>
              <span>
                <i className="status-dot" />
                PostgreSQL
              </span>

              <strong>Bağlı</strong>
            </div>

            <div>
              <span>
                <i className="status-dot" />
                Prisma
              </span>

              <strong>Hazır</strong>
            </div>

            <div>
              <span>
                <i
                  className={
                    apiFootballConfigured
                      ? "status-dot"
                      : "status-dot status-warning"
                  }
                />
                API-Football
              </span>

              <strong>
                {apiFootballConfigured
                  ? "API anahtarı hazır"
                  : "API anahtarı eksik"}
              </strong>
            </div>

            <div>
              <span>
                <i className="status-dot" />
                Tahmin motoru
              </span>

              <strong>Aktif</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="admin-card process-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PIPELINE</p>

            <h2>İşlem aşamaları</h2>
          </div>

          <button
            className="secondary-button"
            type="button"
          >
            Logları görüntüle
          </button>
        </div>

        <div className="process-list">
          {processSteps.map((step, index) => (
            <div
              className="process-item"
              key={step.name}
            >
              <span className="process-number">
                {String(index + 1).padStart(
                  2,
                  "0",
                )}
              </span>

              <div>
                <strong>{step.name}</strong>
                <p>{step.description}</p>
              </div>

              <span
                className={
                  step.status === "Kontrol"
                    ? "process-status process-status-warning"
                    : "process-status"
                }
              >
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
