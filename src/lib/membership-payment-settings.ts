export type MembershipPaymentSettings = {
  ininalUrl: string | null;
  wiseUrl: string | null;
  bankIban: string | null;
  accountName: string | null;
};

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function clean(value: string | undefined, maximumLength: number): string | null {
  const result = value?.trim().slice(0, maximumLength);
  return result || null;
}

export function getMembershipPaymentSettings(): MembershipPaymentSettings {
  return {
    ininalUrl: safeUrl(process.env.ININAL_PAYMENT_URL),
    wiseUrl: safeUrl(process.env.WISE_PAYMENT_URL),
    bankIban: clean(process.env.BANK_TRANSFER_IBAN, 42),
    accountName: clean(process.env.PAYMENT_ACCOUNT_NAME, 120),
  };
}
