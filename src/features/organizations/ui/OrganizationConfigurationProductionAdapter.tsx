import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { productionSessionContextGet } from "../../../ui/production/productionSessionContextGet.js"
import { OrganizationConfigurationShellView } from "./OrganizationConfigurationShellView.js"
import { organizationAdminProductionStateCreate } from "./organizationAdminProductionStateCreate.js"
import { organizationConfigurationScreenStateCreate } from "./organizationConfigurationScreenStateCreate.js"
import { organizationConfigurationSectionSelect } from "./organizationConfigurationSectionSelect.js"

/** Production configuration adapter: shell access from the session context. */
export function OrganizationConfigurationProductionAdapter(props: { readonly section?: string }) {
  const session = productionSessionContextGet()
  const screen = organizationAdminProductionStateCreate({
    organizationId: () => undefined,
    screen: () => "configuration",
  })
  const section = () => organizationConfigurationSectionSelect(props.section)
  const access = () => {
    const current = session.guard.access
    if (current === "loading") return { organizationRoles: [], realmAdministrator: false }
    return { organizationRoles: [...current.organizationRoles], realmAdministrator: current.realmAdministrator }
  }
  const configuration = organizationConfigurationScreenStateCreate({
    access,
    form: screen.form,
    organizationId: screen.page.organizationId,
    page: screen.page,
    screen,
    section,
  })

  return (
    <>
      <OrganizationConfigurationShellView
        branding={configuration.branding}
        canEdit={configuration.canEdit()}
        organizationRoles={configuration.organizationRoles()}
        page={screen.page}
        realmAdministrator={configuration.realmAdministrator()}
        screen={screen}
        section={section()}
      />
      <ConfirmDialog state={screen.confirmState} titleKey="admin.common.confirmTitle" />
    </>
  )
}
