import { useParams } from "@solidjs/router"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { ConfirmDialog } from "../../../ui/confirm/ConfirmDialog.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
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
      <AuthenticatedPageHeader
        description={screen.scenarioDescription()}
        eyebrow={messageTranslate("demo.fixture.preview")}
        meta={
          <>
            <span class="text-xs font-medium text-muted-foreground">{messageTranslate("demo.fixture.state")}</span>
            <DemoFixtureStateSelector options={screen.stateOptions()} />
          </>
        }
        title={screen.scenarioTitle()}
      />
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
