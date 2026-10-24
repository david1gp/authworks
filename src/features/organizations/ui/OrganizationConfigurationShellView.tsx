import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiPaletteOutline } from "@adaptive-ds/mdi/mdiPaletteOutline.js"
import { mdiShieldLockOutline } from "@adaptive-ds/mdi/mdiShieldLockOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { Match, Switch } from "solid-js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedSubNav } from "../../../ui/authenticated/AuthenticatedSubNav.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { OrganizationConfigurationBrandingSection } from "./OrganizationConfigurationBrandingSection.js"
import { OrganizationConfigurationDomainsSection } from "./OrganizationConfigurationDomainsSection.js"
import { OrganizationConfigurationGeneralSection } from "./OrganizationConfigurationGeneralSection.js"
import { OrganizationConfigurationSignInSection } from "./OrganizationConfigurationSignInSection.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"
import type { organizationConfigurationBrandingStateCreate } from "./organizationConfigurationBrandingStateCreate.js"
import { organizationConfigurationCanEdit } from "./organizationConfigurationCanEdit.js"
import type { OrganizationConfigurationSection } from "./organizationConfigurationSectionSchema.js"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationScreen = ReturnType<typeof organizationAdminScreenStateCreate>
type ConfigurationBranding = ReturnType<typeof organizationConfigurationBrandingStateCreate>

/** Configuration shell: header, sub-nav, read-only notice, and the active section. */
export function OrganizationConfigurationShellView(props: {
  readonly branding: ConfigurationBranding
  readonly canEdit: boolean
  readonly organizationRoles: readonly string[]
  readonly page: ConfigurationPage
  readonly realmAdministrator: boolean
  readonly screen: ConfigurationScreen
  readonly section: OrganizationConfigurationSection
}) {
  const basePath = () => props.screen.basePath()
  const sectionHref = (value: string) => `${basePath()}/configuration/${value}`
  const resolvedCanEdit = () =>
    props.canEdit &&
    organizationConfigurationCanEdit({
      organizationRoles: props.organizationRoles,
      realmAdministrator: props.realmAdministrator,
    })

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedSection
        description={messageTranslate("admin.configuration.description")}
        title={messageTranslate("admin.configuration.title")}
      >
        <div class="grid min-w-0 gap-5 px-5 py-4 lg:grid-cols-[13rem_minmax(0,1fr)] [&>*]:min-w-0">
          <AuthenticatedSubNav
            active={props.section}
            items={[
              {
                description: messageTranslate("admin.configuration.generalDescription"),
                href: sectionHref("general"),
                icon: mdiTuneVariant,
                label: messageTranslate("admin.configuration.generalTitle"),
                value: "general",
              },
              {
                description: messageTranslate("admin.configuration.brandingDescription"),
                href: sectionHref("branding"),
                icon: mdiPaletteOutline,
                label: messageTranslate("admin.configuration.brandingTitle"),
                value: "branding",
              },
              {
                description: messageTranslate("admin.configuration.signInDescription"),
                href: sectionHref("sign-in"),
                icon: mdiShieldLockOutline,
                label: messageTranslate("admin.configuration.signInTitle"),
                value: "sign-in",
              },
              {
                description: messageTranslate("admin.configuration.domainsDescription"),
                href: sectionHref("domains"),
                icon: mdiDomain,
                label: messageTranslate("admin.configuration.domainsTitle"),
                value: "domains",
              },
            ]}
            label={messageTranslate("admin.configuration.title")}
          />
          <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
            {!resolvedCanEdit() && <AuthenticatedNotice message={messageTranslate("admin.configuration.readOnly")} />}
            <Switch>
              <Match when={props.section === "general"}>
                <OrganizationConfigurationGeneralSection
                  canEdit={resolvedCanEdit()}
                  page={props.page}
                  screen={props.screen}
                />
              </Match>
              <Match when={props.section === "branding"}>
                <OrganizationConfigurationBrandingSection
                  branding={props.branding}
                  canEdit={resolvedCanEdit()}
                  notice={props.page.notice()}
                  organizationName={props.page.organization()?.name}
                  previewTheme={props.branding.previewTheme()}
                  previewThemeSet={props.branding.previewThemeSet}
                  status={props.page.status()}
                  statusError={props.page.error()}
                  statusRetry={props.page.reload}
                />
              </Match>
              <Match when={props.section === "sign-in"}>
                <OrganizationConfigurationSignInSection
                  canEdit={resolvedCanEdit()}
                  page={props.page}
                  screen={props.screen}
                />
              </Match>
              <Match when={props.section === "domains"}>
                <OrganizationConfigurationDomainsSection
                  canEdit={resolvedCanEdit()}
                  page={props.page}
                  screen={props.screen}
                />
              </Match>
            </Switch>
          </div>
        </div>
      </AuthenticatedSection>
    </div>
  )
}
