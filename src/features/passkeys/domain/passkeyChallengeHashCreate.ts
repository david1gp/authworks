import { createHash } from "node:crypto"

export function passkeyChallengeHashCreate(challenge: string): string {
  return createHash("sha256").update(challenge, "utf8").digest("base64url")
}
