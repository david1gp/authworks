import type { OidcConsent } from "../oidc/public/oidcConsentSchema.js"

export const demoAdminOidcConsents: OidcConsent[] = [
  {
    clientId: "01900000-0000-7000-8000-000000000041",
    createdAt: 1_755_264_000_000,
    realmId: "01900000-0000-7000-8000-000000000001",
    scope: ["openid", "profile", "email"],
    updatedAt: 1_755_782_400_000,
    userId: "01900000-0000-7000-8000-000000000021",
  },
  {
    clientId: "01900000-0000-7000-8000-000000000042",
    createdAt: 1_754_918_400_000,
    realmId: "01900000-0000-7000-8000-000000000001",
    scope: ["openid", "profile"],
    updatedAt: 1_755_609_600_000,
    userId: "01900000-0000-7000-8000-000000000021",
  },
  {
    clientId: "01900000-0000-7000-8000-000000000043",
    createdAt: 1_754_486_400_000,
    realmId: "01900000-0000-7000-8000-000000000001",
    scope: ["openid", "email"],
    updatedAt: 1_755_523_200_000,
    userId: "01900000-0000-7000-8000-000000000022",
  },
] satisfies OidcConsent[]
