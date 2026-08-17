import { createHash } from "node:crypto"

export function instanceSecretHashCreate(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}
