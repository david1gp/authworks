import { describe, expect, test } from "bun:test"
import { loginPrimaryMethodsGet } from "../../src/features/login/model/loginPrimaryMethodsGet.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"

describe("login chooser reference copy", () => {
  test("keeps supported methods in reference order", () => {
    const policy = {
      allowDomainDiscovery: true,
      allowEmailOtp: true,
      allowExternalIdentity: true,
      allowPassword: true,
      allowPasswordRecovery: true,
      allowPasskey: true,
      allowRegistration: true,
      allowWhatsappOtp: true,
      providerIds: ["provider-google"],
    }

    expect(loginPrimaryMethodsGet(policy, 1, true)).toEqual([
      "email-otp",
      "whatsapp-otp",
      "password",
      "passkey",
      "external-identity",
    ])
  })

  test("uses source-equivalent generic method details", () => {
    expect(englishCatalog["login.chooser.emailOtpDetail"]).toBe("Receive a one-time code")
    expect(englishCatalog["login.chooser.whatsappOtpDetail"]).toBe("Receive a one-time code on WhatsApp")
    expect(englishCatalog["login.chooser.passwordDetail"]).toBe("Sign in with password")
    expect(englishCatalog["login.chooser.passkeyDetail"]).toBe("Use your fingerprint, face, or device PIN")
    expect(englishCatalog["login.chooser.providerDetail"]).toBe("Use your existing {provider} account to sign in")
  })

  test("uses focused WhatsApp phone and code copy", () => {
    expect(englishCatalog["login.whatsappOtp.title"]).toBe("Sign in with WhatsApp")
    expect(englishCatalog["login.whatsappOtp.description"]).toBe(
      "We will send you a single-use code on WhatsApp instead of asking for a password.",
    )
    expect(englishCatalog["login.whatsappOtp.codeTitle"]).toBe("WhatsApp verification code")
    expect(englishCatalog["login.whatsappOtp.send"]).toBe("Send WhatsApp code")
  })

  test("uses source-equivalent email OTP headings and code-step copy", () => {
    expect(englishCatalog["login.emailOtp.title"]).toBe("Enter your email")
    expect(englishCatalog["login.emailOtp.codeTitle"]).toBe("Check your email")
    expect(englishCatalog["login.emailOtp.codeDescription"]).toBe("Enter the code sent for {email}.")
    expect(englishCatalog["login.emailOtp.verify"]).toBe("Continue")
  })

  test("keeps chooser copy separate from the MFA challenge copy", () => {
    expect(englishCatalog["login.mfa.totp"]).toBe("Authenticator app")
    expect(englishCatalog["login.mfa.passkey"]).toBe("Passkey")
    expect(englishCatalog["login.mfa.totpChallengeTitle"]).toBe("Authenticator code")
    expect(englishCatalog["login.mfa.passkeyVerify"]).toBe("Verify with Passkey")
  })
})
