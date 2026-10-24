import type { AppLocale } from "@/i18n/dictionaries";
import { translateUiText } from "@/i18n/dictionaries";

/** English source strings — pass through `t()` on client or translateUiText on server. */
export const LOCK_HINT = {
  probabilities: "1/X/2 probabilities are on the Analysis plan",
  modelOdds: "Model odds are on the Analysis plan",
  marketLocked: "This market opens on the Analysis or Professional plan",
  marketLockedDetail: "Upgrade your plan to see the selection and probability.",
} as const;

export function lockHintText(
  key: keyof typeof LOCK_HINT,
  locale: AppLocale,
): string {
  return translateUiText(LOCK_HINT[key], locale);
}
