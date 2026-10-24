import { cookies } from "next/headers";

import type { AppLocale } from "@/i18n/dictionaries";
import { APP_LOCALE_COOKIE } from "@/lib/app-locale";

export { APP_LOCALE_COOKIE };

export async function readAppLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(APP_LOCALE_COOKIE)?.value;
  return value === "tr" ? "tr" : "en";
}
