import { oidcProjectRoleClaim } from "../public/oidcProjectRoleClaim.js"

type OidcAccessTokenRoleClaimsCreateInput = ReadonlyArray<{
  readonly organizationId: string
  readonly primaryDomain: string | undefined
  readonly roleKeys: readonly string[]
}>

// Project roles stay claims-only: Authworks never mints a project
// membership scope from these entries, it only asserts the resolved keys.
// The value is the organization's primary domain when one is verified, and
// the organization id otherwise, so domain-less organizations keep their
// roles instead of vanishing from the claim.
export function oidcAccessTokenRoleClaimsCreate(roles: OidcAccessTokenRoleClaimsCreateInput): Record<string, unknown> {
  const claims: Record<string, Record<string, string>> = {}
  for (const organization of roles) {
    const organizationKey = organization.primaryDomain ?? organization.organizationId
    for (const roleKey of organization.roleKeys) {
      const organizations = claims[roleKey] ?? {}
      organizations[organization.organizationId] = organizationKey
      claims[roleKey] = organizations
    }
  }
  if (Object.keys(claims).length === 0) return {}
  return { [oidcProjectRoleClaim]: claims }
}
