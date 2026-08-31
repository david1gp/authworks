import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"

const now = Date.UTC(2026, 7, 21, 9, 30)

/** Safe, deterministic authentication-method metadata for the administrator demo. */
export const adminDemoUserAuthenticationMethodsFixture: UserAuthenticationMethods = {
  emailOtp: { available: true },
  passkeys: {
    credentials: [
      {
        aaguid: "00000000-0000-0000-0000-000000000001",
        backedUp: true,
        createdAt: now - 2_592_000_000,
        deviceType: "multiDevice",
        id: "passkey-admin-demo",
        lastUsedAt: now - 60_000,
        revokedAt: null,
        transports: ["internal", "hybrid"],
      },
    ],
  },
  password: { available: true },
  recoveryCodes: { available: true, generatedAt: now - 86_400_000, remaining: 7 },
  totp: {
    enrolled: true,
    enrollments: [
      { confirmedAt: now - 2_592_000_000, id: "totp-admin-demo", label: "Authenticator app", status: "active" },
    ],
  },
}
