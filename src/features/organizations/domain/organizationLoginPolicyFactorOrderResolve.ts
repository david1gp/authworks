import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import { organizationLoginPolicyCanonicalFactorOrder } from "./organizationLoginPolicyCanonicalFactorOrder.js"

type OrganizationLoginPolicyFactorOrderResolveOptions = {
  readonly organizationOrder?: readonly MfaPolicyFactor[] | null
  readonly realmOrder?: readonly MfaPolicyFactor[] | null
  readonly permittedFactors: readonly MfaPolicyFactor[]
  readonly runtimeAvailableFactors?: readonly MfaPolicyFactor[]
}

export function organizationLoginPolicyFactorOrderResolve(
  options: OrganizationLoginPolicyFactorOrderResolveOptions,
): MfaPolicyFactor[] {
  const permitted = new Set(options.permittedFactors)
  const runtimeAvailable = new Set(options.runtimeAvailableFactors ?? options.permittedFactors)
  const result: MfaPolicyFactor[] = []
  const seen = new Set<MfaPolicyFactor>()
  const candidates = [
    ...(options.organizationOrder ?? []),
    ...(options.realmOrder ?? []),
    ...organizationLoginPolicyCanonicalFactorOrder,
  ]
  for (const factor of candidates) {
    if (seen.has(factor) || !permitted.has(factor) || !runtimeAvailable.has(factor)) continue
    seen.add(factor)
    result.push(factor)
  }
  return result
}
