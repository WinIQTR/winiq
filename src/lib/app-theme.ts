export type AppTheme = "light" | "dark";

/** localStorage + cookie key for UI appearance (not match daypart). */
export const APP_THEME_COOKIE = "bet-project-theme";

export function parseAppTheme(value: string | null | undefined): AppTheme {
  return value === "dark" ? "dark" : "light";
}
