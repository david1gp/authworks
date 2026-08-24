import { createHash } from "node:crypto"

export function whatsappOtpPhoneHashCreate(phoneNumber: string): string {
  return createHash("sha256").update(phoneNumber, "utf8").digest("hex")
}
