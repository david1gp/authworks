import type { ResultErr } from "#result"
import { oidcCodelineProductionOrganizationIdGetFailureExitCodes } from "./oidcCodelineProductionOrganizationIdGetFailureExitCodes.js"

const internalFailureCode = "oidc.codeline-organization-id-get.internal-failed"

export function oidcCodelineProductionOrganizationIdGetExitCodeGet(failure: ResultErr | string): number {
  const code = typeof failure === "string" ? failure : failure.code
  return (
    oidcCodelineProductionOrganizationIdGetFailureExitCodes.get(code ?? "") ??
    (oidcCodelineProductionOrganizationIdGetFailureExitCodes.get(internalFailureCode) as number)
  )
}
