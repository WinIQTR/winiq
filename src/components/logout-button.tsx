"use client";

import { useLanguage } from "@/components/language-provider";

export function LogoutButton() {
  const { t } = useLanguage();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <button className="logout-button" type="button" onClick={logout}>
      {t("Sign out")}
    </button>
  );
}
