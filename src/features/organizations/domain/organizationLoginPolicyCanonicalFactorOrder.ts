import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"

export const organizationLoginPolicyCanonicalFactorOrder: readonly MfaPolicyFactor[] = ["passkey", "totp", "email_otp"]
