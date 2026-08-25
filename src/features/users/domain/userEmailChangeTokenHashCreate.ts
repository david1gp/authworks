import { createHash } from "node:crypto"

export function userEmailChangeTokenHashCreate(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}
