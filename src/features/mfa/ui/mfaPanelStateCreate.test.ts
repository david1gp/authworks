import { describe, expect, test } from "bun:test"
import { mfaPanelStateCreate } from "./mfaPanelStateCreate.js"

describe("mfaPanelStateCreate", () => {
  test("keeps unavailable factors visible but non-selectable", () => {
    const selected: string[] = []
    const state = mfaPanelStateCreate({
      factorAvailability: () => ({ "email-otp": false, passkey: false, "recovery-code": true, totp: true }),
      factors: () => ["totp", "email-otp", "passkey", "recovery-code"],
      mode: () => "select",
      onSelect: (factor) => selected.push(factor),
    })

    expect(state.factorItems()).toEqual([
      {
        available: true,
        detail: "login.mfa.totpDetail",
        factor: "totp",
        label: "login.mfa.totp",
      },
      {
        available: false,
        detail: "login.mfa.emailOtpDetail",
        factor: "email-otp",
        label: "login.mfa.emailOtp",
      },
      {
        available: false,
        detail: "login.mfa.passkeyDetail",
        factor: "passkey",
        label: "login.mfa.passkey",
      },
      {
        available: true,
        detail: "login.mfa.recoveryCodeDetail",
        factor: "recovery-code",
        label: "login.mfa.recoveryCode",
      },
    ])
    state.selectFactor("totp")
    expect(selected).toEqual(["totp"])
  })
})
