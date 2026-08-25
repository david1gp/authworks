import type { ResultErr } from "#result"
import { oidcCodelineProductionOrganizationIdGetFailureExitCodes } from "./oidcCodelineProductionOrganizationIdGetFailureExitCodes.js"

const internalFailureCode = "oidc.codeline-organization-id-get.internal-failed"

export function oidcCodelineProductionOrganizationIdGetFailureOutputCreate(failure: ResultErr | string): string {
  const candidate = typeof failure === "string" ? failure : failure.code
  const code =
    candidate !== undefined && oidcCodelineProductionOrganizationIdGetFailureExitCodes.has(candidate)
      ? candidate
      : internalFailureCode
  return `${JSON.stringify({ error: { code } })}\n`
}
