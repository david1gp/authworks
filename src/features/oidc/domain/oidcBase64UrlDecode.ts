export function oidcBase64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null
  if (value.length % 4 === 1) return null
  try {
    const decoded = new Uint8Array(Buffer.from(value, "base64url"))
    if (Buffer.from(decoded).toString("base64url") !== value) return null
    return decoded
  } catch (_error) {
    return null
  }
}
