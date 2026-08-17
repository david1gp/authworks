import { createHash } from "node:crypto"

export function emailOtpEmailHashCreate(email: string): string {
  return createHash("sha256").update(email, "utf8").digest("hex")
}
