import { describe, expect, test } from "bun:test"
import { mfaTotpProvisioningQrGet } from "./mfaTotpProvisioningQrGet.js"

describe("mfaTotpProvisioningQrGet", () => {
  test("renders a valid Authenticator provisioning URI as compact SVG path data", () => {
    const result = mfaTotpProvisioningQrGet(
      "otpauth://totp/Acme:alex%40acme.example?secret=JBSWY3DPEHPK3PXP&issuer=Acme",
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.viewBoxSize).toBeGreaterThan(20)
    expect(result.data.path).toContain("M")
  })

  test("rejects non-TOTP setup URIs safely", () => {
    expect(mfaTotpProvisioningQrGet("https://example.com/setup").success).toBe(false)
  })
})
