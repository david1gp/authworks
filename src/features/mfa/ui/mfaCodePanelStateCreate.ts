import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { MfaFactor } from "../model/mfaFactorSchema.js"

export function mfaCodePanelStateCreate(kind: () => Extract<MfaFactor, "recovery-code" | "totp">) {
  return {
    description: (): MessageKey =>
      kind() === "totp" ? "login.mfa.totpDescription" : "login.mfa.recoveryCodeDescription",
    inputMode: () => (kind() === "totp" ? "numeric" : "text"),
    label: (): MessageKey => (kind() === "totp" ? "login.mfa.verificationCode" : "login.mfa.recoveryCodeLabel"),
    maxLength: () => (kind() === "totp" ? "6" : "64"),
    pattern: () => (kind() === "totp" ? "[0-9]{6}" : "[A-Z0-9-]{8,64}"),
    title: (): MessageKey => (kind() === "totp" ? "login.mfa.totpChallengeTitle" : "login.mfa.recoveryCode"),
  }
}
