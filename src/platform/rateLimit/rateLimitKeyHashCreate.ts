import { createHmac } from "node:crypto"
import type { Secret } from "../secrets/Secret.js"

export function rateLimitKeyHashCreate(secret: Secret | string, value: string): string {
  return createHmac("sha256", typeof secret === "string" ? secret : secret.valueGet())
    .update(value, "utf8")
    .digest("hex")
}
