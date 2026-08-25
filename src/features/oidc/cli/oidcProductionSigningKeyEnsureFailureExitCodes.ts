export const oidcProductionSigningKeyEnsureFailureExitCodes: ReadonlyMap<string, number> = new Map([
  ["oidc.production-signing-key-ensure.input-invalid", 40],
  ["oidc.production-signing-key-ensure.realm-not-found", 41],
  ["oidc.production-signing-key-ensure.realm-ambiguous", 42],
  ["oidc.production-signing-key-ensure.realm-inactive", 43],
  ["oidc.production-signing-key-ensure.api-unauthorized", 44],
  ["oidc.production-signing-key-ensure.api-unreachable", 45],
  ["oidc.production-signing-key-ensure.api-invalid-response", 46],
  ["oidc.production-signing-key-ensure.key-ambiguous", 47],
  ["oidc.production-signing-key-ensure.ensure-rejected", 48],
  ["oidc.production-signing-key-ensure.verification-failed", 49],
  ["oidc.production-signing-key-ensure.internal-failed", 50],
])
