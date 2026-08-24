const roleMap = new Map<string, "owner" | "admin" | "member" | "guest">([
  ["ORG_OWNER", "owner"],
  ["ORG_OWNER_VIEWER", "guest"],
  ["ORG_PROJECT_OWNER", "admin"],
  ["ORG_PROJECT_GRANT_OWNER", "admin"],
  ["ORG_PROJECT_GRANT_USER", "member"],
  ["ORG_PROJECT_GRANT_VIEWER", "guest"],
  ["ORG_USER_MANAGER", "admin"],
  ["ORG_USER_VIEWER", "guest"],
  ["ORG_IDP_MANAGER", "admin"],
  ["ORG_IDP_VIEWER", "guest"],
  ["ORG_POLICY_MANAGER", "admin"],
  ["ORG_POLICY_VIEWER", "guest"],
  ["ORG_FEATURE_MANAGER", "admin"],
  ["ORG_FEATURE_VIEWER", "guest"],
  ["ORG_ACTIONS_MANAGER", "admin"],
  ["ORG_ACTIONS_VIEWER", "guest"],
  ["owner", "owner"],
  ["admin", "admin"],
  ["member", "member"],
  ["guest", "guest"],
])

export function zitadelMigrationOrganizationRolesMap(roles: readonly string[]) {
  const mapped: ("owner" | "admin" | "member" | "guest")[] = []
  const unsupported: string[] = []
  for (const role of roles) {
    const mappedRole = roleMap.get(role)
    if (mappedRole === undefined) unsupported.push(role)
    else if (!mapped.includes(mappedRole)) mapped.push(mappedRole)
  }
  return { mapped: mapped.sort(), unsupported: unsupported.sort() }
}
