import { createHash, scryptSync, timingSafeEqual } from "node:crypto"

export function whatsappOtpCodeMatches(challengeId: string, code: string, expectedHash: string): boolean {
  try {
    const parts = expectedHash.split("$")
    if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "16384" || parts[2] !== "8" || parts[3] !== "1")
      return false
    const salt = createHash("sha256").update(challengeId, "utf8").digest()
    const storedSalt = Buffer.from(parts[4] ?? "", "base64url")
    if (!timingSafeEqual(salt, storedSalt)) return false
    const actual = scryptSync(code, salt, 32, { maxmem: 32 * 1024 * 1024, N: 16_384, p: 1, r: 8 })
    const expected = Buffer.from(parts[5] ?? "", "base64url")
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch (_error) {
    return false
  }
}
