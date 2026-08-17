import { createHash } from "node:crypto"

import { oidcBase64UrlEncode } from "./oidcBase64UrlEncode.js"

export function oidcHashCreate(value: string): string {
  return oidcBase64UrlEncode(createHash("sha256").update(value, "utf8").digest())
}
