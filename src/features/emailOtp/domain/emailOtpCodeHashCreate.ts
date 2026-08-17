import { createHash } from "node:crypto"
import { scryptSync } from "node:crypto"

export function emailOtpCodeHashCreate(challengeId: string, code: string): string {
  const salt = createHash("sha256").update(challengeId, "utf8").digest()
  const hash = scryptSync(code, salt, 32, { maxmem: 32 * 1024 * 1024, N: 16_384, p: 1, r: 8 })
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(hash).toString("base64url")}`
}
