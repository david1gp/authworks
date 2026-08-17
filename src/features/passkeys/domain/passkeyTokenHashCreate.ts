import { createHash } from "node:crypto"

export function passkeyTokenHashCreate(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url")
}
