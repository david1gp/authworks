import type { OidcSigningKey } from "../oidc/public/oidcSigningKeySchema.js"

/** A deterministic, non-secret RSA modulus placeholder. Signing keys never expose private material. */
const modulus =
  "sXchDaQebHnPiGvyDOAT4saGEUetSyo9MKLOoWFsueri23bOdgWp4Dy1WlUzewbgBHod5pcM9H95GQRV3JDXboIRROSBigeC5yjU1hGzHHyXss8UDp_zHhAoR8U0zKrqIrRWM-9Dz5rHqmi-4jrvSgtNGe_wYzPMTh7SEuTfXCoiSw"

export const demoAdminOidcSigningKeys: OidcSigningKey[] = [
  {
    algorithm: "RS256",
    createdAt: 1_755_782_400_000,
    id: "01900000-0000-7000-8000-000000000061",
    realmId: "01900000-0000-7000-8000-000000000001",
    publicJwk: {
      alg: "RS256",
      e: "AQAB",
      kid: "01900000-0000-7000-8000-000000000061",
      kty: "RSA",
      n: modulus,
      use: "sig",
    },
    retiredAt: null,
    status: "active",
  },
  {
    algorithm: "RS256",
    createdAt: 1_753_968_000_000,
    id: "01900000-0000-7000-8000-000000000062",
    realmId: "01900000-0000-7000-8000-000000000001",
    publicJwk: {
      alg: "RS256",
      e: "AQAB",
      kid: "01900000-0000-7000-8000-000000000062",
      kty: "RSA",
      n: `${modulus}Q`,
      use: "sig",
    },
    retiredAt: 1_755_696_000_000,
    status: "retired",
  },
] satisfies OidcSigningKey[]
