import { createHash } from "node:crypto"
import { rateLimitKeyHashCreate } from "../../../platform/rateLimit/rateLimitKeyHashCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"

export function wahaRecipientHashCreate(secret: Secret | string | undefined, phoneNumber: string): string {
  if (secret === undefined || (typeof secret === "string" ? secret.length === 0 : secret.valueGet().length === 0))
    return createHash("sha256").update(phoneNumber, "utf8").digest("hex")
  return rateLimitKeyHashCreate(secret, phoneNumber)
}
