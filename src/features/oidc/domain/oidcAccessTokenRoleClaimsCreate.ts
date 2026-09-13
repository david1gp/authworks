const oidcProjectRoleClaim = "urn:zitadel:iam:org:project:roles"

type OidcAccessTokenRoleClaimsCreateInput = ReadonlyArray<{
  readonly organizationId: string
  readonly primaryDomain: string | undefined
  readonly roleKeys: readonly string[]
}>

export function oidcAccessTokenRoleClaimsCreate(roles: OidcAccessTokenRoleClaimsCreateInput): Record<string, unknown> {
  const claims: Record<string, Record<string, string>> = {}
  for (const organization of roles) {
    if (organization.primaryDomain === undefined) continue
    for (const roleKey of organization.roleKeys) {
      const organizations = claims[roleKey] ?? {}
      organizations[organization.organizationId] = organization.primaryDomain
      claims[roleKey] = organizations
    }
  }
  if (Object.keys(claims).length === 0) return {}
  return { [oidcProjectRoleClaim]: claims }
}
