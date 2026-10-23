/** Client-side redirects for removed admin routes. Exact map from the rework plan. */
const productionAdminRedirectTable: Readonly<Record<string, string>> = {
  "/admin": "/admin/users",
  "/admin/branding": "/admin/configuration/branding",
  "/admin/configuration": "/admin/configuration/general",
  "/admin/domains": "/admin/configuration/domains",
  "/admin/invitations": "/admin/users?tab=invitations",
  "/admin/machine-users": "/admin/users?tab=service-accounts",
  "/admin/memberships": "/admin/users",
}

export function productionAdminRedirectSelect(pathname: string): string | undefined {
  const direct = productionAdminRedirectTable[pathname]
  if (direct !== undefined) return direct
  const projectMatch = /^\/admin\/projects\/([^/]+)\/(applications|roles-grants|effective-access)$/.exec(pathname)
  if (projectMatch === null) return undefined
  const tab =
    projectMatch[2] === "applications" ? "applications" : projectMatch[2] === "roles-grants" ? "roles" : "access"
  return `/admin/projects/${projectMatch[1]}?tab=${tab}`
}
