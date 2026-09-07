import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { translateUiText } from "../src/i18n/dictionaries";

const root = process.cwd();

const translationCases = [
  ["Üye girişi", "Member login"],
  ["Bugünün tahminleri", "Today's predictions"],
  ["Üye yönetimi", "Member management"],
  ["Yükseltme talepleri", "Upgrade requests"],
  ["Üretim Operasyon Merkezi", "Production Operations Center"],
  ["Sonuç Uzlaştırma ve Skor Uyarıları", "Result Reconciliation and Score Alerts"],
  ["Value Bet Accuracy Dashboard", "Değerli Bahis Doğruluk Paneli"],
  ["Show details", "Detayları göster"],
  ["Hide details", "Detayları gizle"],
] as const;

for (const [source, expected] of translationCases) {
  const locale = /[çğıöşüİ]/i.test(source) || source === "Bugünün tahminleri" || source === "Üye yönetimi"
    ? "en"
    : "tr";
  assert.equal(translateUiText(source, locale), expected, `${source} did not translate to ${locale}`);
}

assert.equal(
  translateUiText("3 aktif talep", "en"),
  "3 active requests",
  "Dynamic request count was not translated",
);
assert.equal(
  translateUiText("4 registered members", "tr"),
  "4 kayıtlı üye",
  "Dynamic member count was not translated",
);
assert.equal(
  translateUiText("Merhaba Test User. Yalnız bugünün yayınlanmış seçimleri gösteriliyor.", "en"),
  "Hello Test User. Only today's published selections are shown.",
  "Dynamic member greeting was not translated",
);

const provider = readFileSync(join(root, "src/components/language-provider.tsx"), "utf8");
for (const required of ["attributes: true", '"aria-label"', '"placeholder"', '"title"']) {
  assert.match(provider, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const guide = readFileSync(join(root, "SITE-BOX-GUIDE-TR-EN.md"), "utf8");
for (const route of [
  "/admin-dashboard",
  "/predictions",
  "/smart-picks",
  "/evaluation",
  "/fixtures",
  "/teams",
  "/players",
  "/admin",
  "/admin/members",
  "/settings",
  "/operations",
  "/value-bets",
  "/member",
  "/member/plans",
  "/login",
]) {
  assert.ok(guide.includes(`\`${route}\``), `${route} is missing from the page-box guide`);
}

console.log("Full Site TR/EN Language Consistency and Page Guide V6.7 tests passed.");
