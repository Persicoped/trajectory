import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const password = z.string().min(10, "Use 10 characters or more.").max(200);

// scrypt with a random salt. The stored text holds the settings, so they can
// change later and old passwords still check.
const N = 32768;
const R = 8;
const P = 1;
const KEY = 32;
const derive = (plain: string, salt: Buffer, n: number, r: number, p: number, len: number) =>
  scryptSync(plain, salt, len, { N: n, r, p, maxmem: 128 * n * r * 2 });

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  return ["scrypt", N, R, P, salt.toString("hex"), derive(plain, salt, N, R, P, KEY).toString("hex")].join(":");
}

// With no stored password, the check does the same work, so the reply time
// does not tell a caller whether the account exists.
const EMPTY = ["scrypt", N, R, P, "00".repeat(16), "00".repeat(KEY)].join(":");

export function verifyPassword(plain: string, stored: string | undefined): boolean {
  const [kind, n, r, p, salt, hash] = (stored ?? EMPTY).split(":");
  if (kind !== "scrypt") return false;
  const want = Buffer.from(hash, "hex");
  const got = derive(plain, Buffer.from(salt, "hex"), Number(n), Number(r), Number(p), want.length);
  return timingSafeEqual(got, want) && stored !== undefined;
}
