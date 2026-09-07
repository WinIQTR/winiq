import { PageShell } from "@/components/page-shell";

import {
  ACTIVE_SEASON_LABEL,
  ACTIVE_SEASON_YEAR,
} from "@/config/season";

export default function SettingsPage() {
  return (
    <PageShell>
      <header className="topbar">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>Ayarlar</h1>
          <p className="subtitle">
            Lig, sezon ve tahmin çalışma ayarları.
          </p>
        </div>
      </header>

      <section className="admin-card settings-card">
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
              {ACTIVE_SEASON_LABEL} Canlı
            </option>
          </select>
        </label>

        <label className="field">
          <span>Minimum tahmin olasılığı</span>

          <select defaultValue="57">
            <option value="55">%55</option>
            <option value="57">%57</option>
            <option value="60">%60</option>
            <option value="65">%65</option>
          </select>
        </label>

        <button
          className="primary-button settings-save"
          type="button"
        >
          Ayarları kaydet
        </button>

        <p className="subtitle">
          Canlı sayfalar yalnızca {ACTIVE_SEASON_LABEL} sezonunu kullanır.
          Tarihsel model testleri üretim verisine karıştırılmaz.
        </p>
      </section>
    </PageShell>
  );
}
