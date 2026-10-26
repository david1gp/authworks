import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"

type SessionMfaCheckExpiredOptions = {
  readonly assurance: string
  readonly createdAt: number
  readonly mfaMethod: string | null
  readonly now: number
  readonly policy: Pick<OrganizationLoginPolicy, "multiFactorCheckLifetimeSeconds" | "secondFactorCheckLifetimeSeconds">
}

export function sessionMfaCheckExpired(options: SessionMfaCheckExpiredOptions): boolean {
  if (options.assurance !== "multi_factor") return false
  const lifetime =
    options.mfaMethod === "passkey"
      ? options.policy.multiFactorCheckLifetimeSeconds
      : options.policy.secondFactorCheckLifetimeSeconds
  if (lifetime === null || lifetime === undefined) return false
  return options.now - options.createdAt > lifetime * 1_000
}
