import { useLocation } from "@solidjs/router"
import { adminDemoAccessSelect } from "../../admin/ui/adminDemoAppStateCreate.js"
import type { organizationAdminFormStateCreate } from "./organizationAdminFormStateCreate.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"
import { organizationConfigurationBrandingStateCreate } from "./organizationConfigurationBrandingStateCreate.js"
import { organizationConfigurationCanEdit } from "./organizationConfigurationCanEdit.js"
import type { OrganizationConfigurationSection } from "./organizationConfigurationSectionSchema.js"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationForm = ReturnType<typeof organizationAdminFormStateCreate>
type ConfigurationScreen = ReturnType<typeof organizationAdminScreenStateCreate>

/**
 * Glues the configuration sections to access and branding state. Demo resolves `?as=` into
 * owner/admin/realm-admin; production passes the shell access explicitly.
 */
export function organizationConfigurationScreenStateCreate(options: {
  readonly form: ConfigurationForm
  readonly organizationId: () => string
  readonly page: ConfigurationPage
  readonly screen: ConfigurationScreen
  readonly section: () => OrganizationConfigurationSection
  readonly access?: () => { readonly organizationRoles: readonly string[]; readonly realmAdministrator: boolean }
}) {
  const location = useLocation()
  const branding = organizationConfigurationBrandingStateCreate({
    form: options.form,
    organizationId: options.organizationId,
    page: options.page,
  })
  const demoAccess = () =>
    options.access === undefined
      ? (() => {
          const selected = adminDemoAccessSelect(location.search)
          return {
            organizationRoles: selected === "owner" ? ["owner"] : selected === "admin" ? ["admin"] : [],
            realmAdministrator: selected === "realm-admin",
          }
        })()
      : options.access()

  const canEdit = () =>
    organizationConfigurationCanEdit({
      organizationRoles: demoAccess().organizationRoles,
      realmAdministrator: demoAccess().realmAdministrator,
    })

  return {
    branding,
    canEdit,
    organizationRoles: () => demoAccess().organizationRoles,
    realmAdministrator: () => demoAccess().realmAdministrator,
    section: options.section,
  }
}

export type OrganizationConfigurationScreenState = ReturnType<typeof organizationConfigurationScreenStateCreate>
