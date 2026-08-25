import type { ResultErr } from "#result"
import { oidcProductionSigningKeyEnsureFailureExitCodes } from "./oidcProductionSigningKeyEnsureFailureExitCodes.js"

const internalFailureCode = "oidc.production-signing-key-ensure.internal-failed"

export function oidcProductionSigningKeyEnsureExitCodeGet(failure: ResultErr | string): number {
  const code = typeof failure === "string" ? failure : failure.code
  return (
    oidcProductionSigningKeyEnsureFailureExitCodes.get(code ?? "") ??
    (oidcProductionSigningKeyEnsureFailureExitCodes.get(internalFailureCode) as number)
  )
}
