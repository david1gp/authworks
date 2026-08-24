import { describe, expect, test } from "bun:test"
import { mfaCodePanelStateCreate } from "./mfaCodePanelStateCreate.js"

describe("mfaCodePanelStateCreate", () => {
  test("uses the authenticator code heading for TOTP challenges", () => {
    const state = mfaCodePanelStateCreate(() => "totp")

    expect(state.title()).toBe("login.mfa.totpChallengeTitle")
  })

  test("keeps recovery code challenge copy unchanged", () => {
    const state = mfaCodePanelStateCreate(() => "recovery-code")

    expect(state.title()).toBe("login.mfa.recoveryCode")
  })
})
