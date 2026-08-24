import { describe, expect, test } from "bun:test"
import { passkeyPanelStateCreate } from "./passkeyPanelStateCreate.js"

describe("passkeyPanelStateCreate", () => {
  test("keeps MFA passkey verification distinct from the unavailable enrollment contract", () => {
    const available = passkeyPanelStateCreate({
      mfaAvailable: () => true,
      mfaContinuation: () => true,
      supported: () => true,
    })
    const unavailable = passkeyPanelStateCreate({
      mfaAvailable: () => false,
      mfaContinuation: () => true,
      supported: () => true,
    })

    expect(available.canVerify()).toBe(true)
    expect(available.unavailable()).toBe(false)
    expect(unavailable.canVerify()).toBe(false)
    expect(unavailable.unavailable()).toBe(true)
  })
})
