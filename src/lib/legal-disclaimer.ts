/**
 * Short TR membership / analysis disclaimer for public surfaces (Blok C).
 * Not legal advice — keep conservative; Gammon may tighten with counsel.
 */
export const LEGAL_DISCLAIMER_TR = {
  title: "Sorumluluk / bilgilendirme",
  short:
    "WINIQ yalnızca analiz ve bilgilendirme sunar; kazanç garantisi yoktur. Bahis kararları size aittir.",
  body: [
    "Üyelik; model olasılıkları, maç özetleri ve geçmiş isabet ÖZET’ine erişim sağlar. Bu bir yatırım, kumar işletmesi veya “garanti kupon” hizmeti değildir.",
    "İsabet oranları geçmiş settled kayıtlara dayanır; gelecek sonuçları garanti etmez. Void / ertelenen maçlar isabet hesabından ayrı gösterilir.",
    "18 yaş altı kullanıma uygun değildir. Yasalara ve kendi bütçe sınırlarınıza uygun hareket edin.",
  ],
} as const;

export const LEGAL_DISCLAIMER_EN = {
  title: "Disclaimer",
  short:
    "WINIQ provides analysis only; there is no profit guarantee. Betting decisions are yours.",
  body: [
    "Membership unlocks model probabilities, match summaries, and a settled hit-rate overview. This is not an investment product, gambling operator, or guaranteed tip service.",
    "Hit rates reflect past settled records and do not guarantee future outcomes. Voids / postponed matches are shown separately from the hit-rate denominator.",
    "Not intended for users under 18. Follow local laws and your own bankroll limits.",
  ],
} as const;
