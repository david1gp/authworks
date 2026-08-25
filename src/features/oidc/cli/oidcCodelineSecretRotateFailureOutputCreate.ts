import type { ResultErr } from "#result"
import { oidcCodelineSecretRotateFailureExitCodes } from "./oidcCodelineSecretRotateFailureExitCodes.js"

const internalFailureCode = "oidc.codeline-secret-rotate.internal-failed"

export function oidcCodelineSecretRotateFailureOutputCreate(failure: ResultErr | string): string {
  const candidate = typeof failure === "string" ? failure : failure.code
  const code =
    candidate !== undefined && oidcCodelineSecretRotateFailureExitCodes.has(candidate) ? candidate : internalFailureCode
  return `${JSON.stringify({ error: { code } })}\n`
}
