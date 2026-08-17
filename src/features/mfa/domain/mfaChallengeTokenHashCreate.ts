import { createHash } from "node:crypto"

export function mfaChallengeTokenHashCreate(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url")
}
