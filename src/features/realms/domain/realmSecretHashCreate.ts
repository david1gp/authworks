import { createHash } from "node:crypto"

export function realmSecretHashCreate(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}
