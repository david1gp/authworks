import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"

export const organizationLoginPolicyCanonicalFactorOrder: readonly MfaPolicyFactor[] = ["totp", "email_otp", "passkey"]
