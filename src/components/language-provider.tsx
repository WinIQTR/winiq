"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  translateUiText,
  type AppLocale,
} from "@/i18n/dictionaries";

const STORAGE_KEY = "bet-project-language";

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (source: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const originalText = new WeakMap<Text, { source: string; last: string }>();
const originalAttributes = new WeakMap<Element, Map<string, { source: string; last: string }>>();

function translateTextNode(node: Text, locale: AppLocale) {
  const parent = node.parentElement;
  if (!parent || parent.closest("script, style, code, pre, [data-no-translate]")) return;

  const current = node.nodeValue ?? "";
  const record = originalText.get(node);
  const source = record && current === record.last ? record.source : current;
  const next = translateUiText(source, locale);

  originalText.set(node, { source, last: next });
  if (current !== next) node.nodeValue = next;
}

function translateAttributes(element: Element, locale: AppLocale) {
  const attributes = ["aria-label", "placeholder", "title"];
  let records = originalAttributes.get(element);

  if (!records) {
    records = new Map();
    originalAttributes.set(element, records);
  }

  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;

    const record = records.get(attribute);
    const source = record && current === record.last ? record.source : current;
    const next = translateUiText(source, locale);

    records.set(attribute, { source, last: next });
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function translateDateElement(element: Element, locale: AppLocale) {
  const value = element.getAttribute("data-i18n-date");
  if (!value) return;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;

  const type = element.getAttribute("data-i18n-date-type") ?? "date";
  const language = locale === "tr" ? "tr-TR" : "en-GB";
  const options: Intl.DateTimeFormatOptions =
    type === "time"
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Europe/Istanbul",
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Europe/Istanbul",
        };

  const next = new Intl.DateTimeFormat(language, options).format(date);
  if (element.textContent !== next) element.textContent = next;
}

function translateSubtree(root: Node, locale: AppLocale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }

  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof Element) {
    translateAttributes(root, locale);
    translateDateElement(root, locale);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale);
    else {
      translateAttributes(node as Element, locale);
      translateDateElement(node as Element, locale);
    }
    node = walker.nextNode();
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "tr" || saved === "en" ? saved : "en";
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
    translateSubtree(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateSubtree(mutation.target, locale);
        if (mutation.type === "attributes") translateSubtree(mutation.target, locale);
        for (const node of mutation.addedNodes) translateSubtree(node, locale);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "placeholder",
        "title",
        "data-i18n-date",
        "data-i18n-date-type",
      ],
    });
    return () => observer.disconnect();
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback((source: string) => translateUiText(source, locale), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
