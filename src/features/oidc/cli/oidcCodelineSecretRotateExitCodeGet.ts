import type { ResultErr } from "#result"
import { oidcCodelineSecretRotateFailureExitCodes } from "./oidcCodelineSecretRotateFailureExitCodes.js"

const internalFailureCode = "oidc.codeline-secret-rotate.internal-failed"

export function oidcCodelineSecretRotateExitCodeGet(failure: ResultErr | string): number {
  const code = typeof failure === "string" ? failure : failure.code
  return (
    oidcCodelineSecretRotateFailureExitCodes.get(code ?? "") ??
    (oidcCodelineSecretRotateFailureExitCodes.get(internalFailureCode) as number)
  )
}
