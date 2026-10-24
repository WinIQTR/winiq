"use client";

import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";

import styles from "./theme-toggle.module.css";

function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3V21.5M2.5 12h2.2M19.3 12H21.5M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6l1.6-1.6M17 7l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16.5 3.2A8.8 8.8 0 1 0 20.8 14 7.2 7.2 0 0 1 16.5 3.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      className={styles.toggle}
      role="group"
      aria-label={t("Appearance")}
      data-no-translate
    >
      <button
        type="button"
        className={styles.option}
        data-active={theme === "light" ? "true" : undefined}
        aria-pressed={theme === "light"}
        title={t("Light")}
        onClick={() => setTheme("light")}
      >
        <IconSun />
      </button>
      <button
        type="button"
        className={styles.option}
        data-active={theme === "dark" ? "true" : undefined}
        aria-pressed={theme === "dark"}
        title={t("Dark")}
        onClick={() => setTheme("dark")}
      >
        <IconMoon />
      </button>
    </div>
  );
}
