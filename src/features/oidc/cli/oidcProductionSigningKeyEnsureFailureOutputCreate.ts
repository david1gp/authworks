import type { ResultErr } from "#result"
import { oidcProductionSigningKeyEnsureFailureExitCodes } from "./oidcProductionSigningKeyEnsureFailureExitCodes.js"

const internalFailureCode = "oidc.production-signing-key-ensure.internal-failed"

export function oidcProductionSigningKeyEnsureFailureOutputCreate(failure: ResultErr | string): string {
  const candidate = typeof failure === "string" ? failure : failure.code
  const code =
    candidate !== undefined && oidcProductionSigningKeyEnsureFailureExitCodes.has(candidate)
      ? candidate
      : internalFailureCode
  return `${JSON.stringify({ error: { code } })}\n`
}
