import { createHash } from "node:crypto"

export function mfaRecoveryCodeHashCreate(code: string): string {
  return createHash("sha256").update(code.replaceAll("-", "").toUpperCase(), "utf8").digest("base64url")
}
