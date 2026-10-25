import { useParams } from "@solidjs/router"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { OrganizationConfigurationShellView } from "./OrganizationConfigurationShellView.js"
import { organizationAdminDemoStateCreate } from "./organizationAdminDemoStateCreate.js"
import { organizationConfigurationScreenStateCreate } from "./organizationConfigurationScreenStateCreate.js"
import { organizationConfigurationSectionSelect } from "./organizationConfigurationSectionSelect.js"

/** Demo configuration adapter: fixtures plus `?as=` role selection. */
export function OrganizationConfigurationDemoAdapter() {
  const params = useParams<{ section?: string }>()
  const screen = organizationAdminDemoStateCreate(() => "configuration")
  const section = () => organizationConfigurationSectionSelect(params.section)
  const configuration = organizationConfigurationScreenStateCreate({
    form: screen.form,
    organizationId: screen.page.organizationId,
    page: screen.page,
    screen,
    section,
  })

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
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
    </div>
  )
}
