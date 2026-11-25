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

/** Support SLA + cancellation (Blok F). Conservative defaults; Gammon may tighten. */
export const SUPPORT_POLICY_TR = {
  title: "Destek ve iptal",
  sla: "Destek yanıtı: üye mesajlarına genellikle 1 iş günü içinde dönüş (Europe/Istanbul iş günleri).",
  cancel: [
    "İptal: süre dolmadan erişimi kapatmak için üye panelinden mesaj bırakın veya yöneticiye yazın; kalan gün için otomatik iade yoktur (manuel ödeme).",
    "Yenileme zorunlu değildir. Süre bitince erişim kapanır; hatırlatma T-7’de gönderilir.",
    "Anlaşmazlık veya ödeme teyidi için yönetici notu + ödeme referansı yeterlidir.",
  ],
} as const;

export const SUPPORT_POLICY_EN = {
  title: "Support & cancellation",
  sla: "Support SLA: member messages are usually answered within 1 business day (Europe/Istanbul weekdays).",
  cancel: [
    "Cancel: message from the member desk or contact an admin to close access early; unused days are not auto-refunded (manual payment flow).",
    "Renewal is optional. Access ends when the term expires; a T-7 reminder is sent.",
    "For payment disputes, keep your payment reference and admin note.",
  ],
} as const;
