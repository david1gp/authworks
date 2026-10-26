import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"

const organizationAdminPolicyLifetimeMaximumSeconds = 365 * 24 * 60 * 60

type OrganizationAdminPolicyLifetimeDraft = Pick<
  OrganizationLoginPolicy,
  | "sessionLifetimeSeconds"
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"
>

/** Validates every lifetime field on a login policy draft. Returns a message key when invalid. */
export function organizationAdminPolicyLifetimeValidate(
  draft: OrganizationAdminPolicyLifetimeDraft,
): "admin.organizations.policy.validation.lifetime" | undefined {
  const lifetimes = [
    draft.sessionLifetimeSeconds,
    draft.mfaInitSkipLifetimeSeconds,
    draft.secondFactorCheckLifetimeSeconds,
    draft.multiFactorCheckLifetimeSeconds,
  ]
  const valid = lifetimes.every(
    (lifetime) =>
      lifetime === null ||
      lifetime === undefined ||
      (Number.isInteger(lifetime) && lifetime >= 1 && lifetime <= organizationAdminPolicyLifetimeMaximumSeconds),
  )
  return valid ? undefined : "admin.organizations.policy.validation.lifetime"
}
