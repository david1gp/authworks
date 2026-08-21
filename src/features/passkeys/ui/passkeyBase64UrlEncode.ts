/** Encodes raw WebAuthn bytes as the unpadded base64url form used by the public contracts. */
export function passkeyBase64UrlEncode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}
