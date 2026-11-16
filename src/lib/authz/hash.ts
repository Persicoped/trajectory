import { createHash } from "node:crypto";

// The database keeps only this hash of a token, never the token.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
