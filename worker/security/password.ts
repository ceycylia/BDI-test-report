import {
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual,
} from "./encoding";

export const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

type PasswordRecord = {
  hash: string;
  salt: string;
  iterations: number;
};

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: Uint8Array.from(salt),
      iterations,
    },
    key,
    PASSWORD_HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

export async function hashPassword(
  password: string,
  iterations = PASSWORD_ITERATIONS,
): Promise<PasswordRecord> {
  const salt = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derivePassword(password, salt, iterations);

  return {
    hash: bytesToBase64Url(derived),
    salt: bytesToBase64Url(salt),
    iterations,
  };
}

export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<boolean> {
  const expected = base64UrlToBytes(record.hash);
  const actual = await derivePassword(
    password,
    base64UrlToBytes(record.salt),
    record.iterations,
  );

  return constantTimeEqual(actual, expected);
}
