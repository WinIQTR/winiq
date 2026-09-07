import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 12) errors.push("en az 12 karakter");
  if (!/[a-z]/.test(password)) errors.push("küçük harf");
  if (!/[A-Z]/.test(password)) errors.push("büyük harf");
  if (!/[0-9]/.test(password)) errors.push("rakam");

  return errors;
}

export async function hashPassword(password: string): Promise<string> {
  const problems = validatePasswordStrength(password);

  if (problems.length > 0) {
    throw new Error(`Şifre gereksinimleri: ${problems.join(", ")}.`);
  }

  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encodedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
