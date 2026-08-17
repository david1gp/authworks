import { createHash } from "node:crypto"

export function externalIdentityPkceChallengeCreate(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url")
}
