import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { externalIdentityClientSecretProtect } from "./externalIdentityClientSecretProtect.js"

type ExternalIdentityProviderSecretResolveOptions = {
  readonly allowDevelopmentFallback?: boolean
  readonly encryptionSecret?: Secret | string
  readonly realmId: string
  readonly storedSecret: string
}

export function externalIdentityProviderSecretResolve(
  options: ExternalIdentityProviderSecretResolveOptions,
): Result<string> {
  const op = "externalIdentityProviderSecretResolve"
  if (options.storedSecret.length === 0)
    return resultErrorCreate(op, "The external identity provider is unavailable.", "external-identities.read-failed")
  // Rows written before secret encryption keep the plaintext value. They stay usable until
  // the next provider update re-encrypts them; only the v1 envelope requires a key.
  if (!options.storedSecret.startsWith("v1.")) return resultCreate(options.storedSecret)
  const decrypted = externalIdentityClientSecretProtect(
    "decrypt",
    options.storedSecret,
    options.realmId,
    options.encryptionSecret,
    options.allowDevelopmentFallback === true,
  )
  if (!decrypted.success)
    return resultErrorCreate(op, "The external identity provider is unavailable.", "external-identities.read-failed")
  return decrypted
}
