/** Predicate for owner-like editing rights on the configuration screens. */
export function organizationConfigurationCanEdit(options: {
  readonly organizationRoles: readonly string[]
  readonly realmAdministrator: boolean
}): boolean {
  return options.realmAdministrator || options.organizationRoles.includes("owner")
}
