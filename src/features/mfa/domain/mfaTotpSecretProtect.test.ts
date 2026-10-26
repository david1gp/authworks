import { describe, expect, test } from "bun:test"
import { mfaTotpSecretProtect } from "./mfaTotpSecretProtect.js"

describe("mfaTotpSecretProtect", () => {
  test("fails closed without a secret when the development fallback is disallowed", () => {
    const encrypted = mfaTotpSecretProtect("encrypt", "JBSWY3DPEHPK3PXP", "realm-fail-closed")
    expect(encrypted.success).toBe(false)
  })

  test("keeps the development-only fallback working when explicitly allowed", () => {
    const encrypted = mfaTotpSecretProtect("encrypt", "JBSWY3DPEHPK3PXP", "realm-dev-fallback", undefined, true)
    expect(encrypted.success).toBe(true)
    if (!encrypted.success) return
    const decrypted = mfaTotpSecretProtect("decrypt", encrypted.data, "realm-dev-fallback", undefined, true)
    expect(decrypted.success).toBe(true)
    if (!decrypted.success) return
    expect(decrypted.data).toBe("JBSWY3DPEHPK3PXP")
  })

  test("round-trips with a configured secret and rejects the wrong secret", () => {
    const encrypted = mfaTotpSecretProtect("encrypt", "JBSWY3DPEHPK3PXP", "realm-secret", "configured-secret")
    expect(encrypted.success).toBe(true)
    if (!encrypted.success) return
    const decrypted = mfaTotpSecretProtect("decrypt", encrypted.data, "realm-secret", "configured-secret")
    expect(decrypted.success).toBe(true)
    if (!decrypted.success) return
    expect(decrypted.data).toBe("JBSWY3DPEHPK3PXP")
    const wrong = mfaTotpSecretProtect("decrypt", encrypted.data, "realm-secret", "wrong-secret")
    expect(wrong.success).toBe(false)
  })
})
