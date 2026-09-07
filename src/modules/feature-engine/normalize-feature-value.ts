function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeFeatureValue(options: {
  rawValue: number;
  minimumValue: number;
  maximumValue: number;
  higherIsBetter: boolean;
}): number {
  const {
    rawValue,
    minimumValue,
    maximumValue,
    higherIsBetter,
  } = options;

  if (
    !Number.isFinite(rawValue) ||
    !Number.isFinite(minimumValue) ||
    !Number.isFinite(maximumValue)
  ) {
    throw new Error("Normalizasyon değerleri geçerli sayı olmalıdır.");
  }

  if (maximumValue <= minimumValue) {
    throw new Error(
      "maximumValue, minimumValue değerinden büyük olmalıdır.",
    );
  }

  const boundedValue = clamp(rawValue, minimumValue, maximumValue);

  const ratio =
    (boundedValue - minimumValue) /
    (maximumValue - minimumValue);

  const normalized = higherIsBetter
    ? ratio * 100
    : (1 - ratio) * 100;

  return Math.round(normalized * 100) / 100;
}