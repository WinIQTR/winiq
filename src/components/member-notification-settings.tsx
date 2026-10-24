"use client";

import { FormEvent, useEffect, useState } from "react";

import styles from "@/components/member-smart-dashboard.module.css";

type Settings = {
  notifyEmailEnabled: boolean;
  notifyTelegramEnabled: boolean;
  telegramHandle: string;
  email: string;
};

export function MemberNotificationSettings({
  initial,
}: {
  initial: Settings;
}) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(initial);
  }, [initial]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/member/notification-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notifyEmailEnabled: settings.notifyEmailEnabled,
        notifyTelegramEnabled: settings.notifyTelegramEnabled,
        telegramHandle: settings.telegramHandle,
      }),
    });
    const result = (await response.json()) as { success: boolean; message: string };
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <form className={styles.planChip} id="bildirimler" onSubmit={onSubmit}>
      <small>BİLDİRİMLER</small>
      <strong>Günün güçlü seçimleri</strong>
      <span style={{ color: "#8ea4b9", fontSize: 12 }}>
        Tercihleriniz hesabınıza kaydedilir. Gönderim altyapısı hazır olunca e-posta /
        Telegram ile iletilir.
      </span>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <input
          type="checkbox"
          checked={settings.notifyEmailEnabled}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, notifyEmailEnabled: event.target.checked }))
          }
        />
        E-posta bildirimi ({settings.email})
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={settings.notifyTelegramEnabled}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              notifyTelegramEnabled: event.target.checked,
            }))
          }
        />
        Telegram bildirimi
      </label>

      <label style={{ display: "grid", gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: "#8ea4b9" }}>Telegram kullanıcı adı</span>
        <input
          value={settings.telegramHandle}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, telegramHandle: event.target.value }))
          }
          placeholder="@kullanici"
          maxLength={64}
          disabled={!settings.notifyTelegramEnabled}
          style={{
            minHeight: 40,
            borderRadius: 8,
            border: "1px solid #2c526c",
            background: "#091f33",
            color: "#edf8ff",
            padding: "8px 10px",
          }}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        style={{
          marginTop: 10,
          minHeight: 40,
          borderRadius: 8,
          border: "1px solid #39d7a2",
          background: "#1a3d34",
          color: "#9ef0c8",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {busy ? "Kaydediliyor…" : "Tercihleri kaydet"}
      </button>
      {message ? (
        <small style={{ color: "#9ef0c8", marginTop: 6 }}>{message}</small>
      ) : null}
    </form>
  );
}
