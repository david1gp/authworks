export function oidcBase64UrlEncode(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value
  return Buffer.from(bytes).toString("base64url")
}
