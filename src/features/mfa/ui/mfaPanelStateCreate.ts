import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { MfaFactor } from "../model/mfaFactorSchema.js"
import type { MfaPanelMode } from "../model/mfaPanelModeSchema.js"

type MfaPanelStateCreateOptions = {
  readonly factors: () => readonly MfaFactor[]
  readonly factorAvailability: () => Partial<Record<MfaFactor, boolean>> | undefined
  readonly mode: () => MfaPanelMode
  readonly onSelect: (factor: MfaFactor) => void
}

const factorDetails: Readonly<Record<MfaFactor, MessageKey>> = {
  email_otp: "login.mfa.emailOtpDetail",
  passkey: "login.mfa.passkeyDetail",
  recovery_code: "login.mfa.recoveryCodeDetail",
  totp: "login.mfa.totpDetail",
}

const factorLabels: Readonly<Record<MfaFactor, MessageKey>> = {
  email_otp: "login.mfa.emailOtp",
  passkey: "login.mfa.passkey",
  recovery_code: "login.mfa.recoveryCode",
  totp: "login.mfa.totp",
}

export function mfaPanelStateCreate(options: MfaPanelStateCreateOptions) {
  return {
    factorItems: () =>
      options.factors().map((factor) => ({
        available: options.factorAvailability()?.[factor] !== false,
        detail: factorDetails[factor],
        factor,
        label: factorLabels[factor],
      })),
    mode: options.mode,
    selectFactor: options.onSelect,
  }
}
