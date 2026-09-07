"use client";

import { useLanguage } from "@/components/language-provider";
import { APP_LANGUAGES } from "@/i18n/dictionaries";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="language-switcher" aria-label={t("Language")} data-no-translate>
      <span>{locale === "tr" ? "Dil" : "Language"}</span>
      <div className="language-switcher-options">
        {APP_LANGUAGES.map((language) => (
          <button
            key={language.code}
            type="button"
            className={locale === language.code ? "language-option language-option-active" : "language-option"}
            aria-pressed={locale === language.code}
            title={language.label}
            onClick={() => setLocale(language.code)}
          >
            {language.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
