import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiPaletteOutline } from "@adaptive-ds/mdi/mdiPaletteOutline.js"
import { mdiShieldLockOutline } from "@adaptive-ds/mdi/mdiShieldLockOutline.js"
import { mdiTuneVariant } from "@adaptive-ds/mdi/mdiTuneVariant.js"
import { useParams } from "@solidjs/router"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedSubNav } from "../../../ui/authenticated/AuthenticatedSubNav.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { DirectoryAdminPlaceholder } from "../../directory/ui/DirectoryAdminPlaceholder.js"
import { organizationConfigurationSectionSelect } from "./organizationConfigurationSectionSelect.js"

/** Configuration shell with sub-navigation; full section content lands with the page task. */
export function OrganizationConfigurationPlaceholder() {
  const params = useParams<{ section?: string }>()
  const section = () => organizationConfigurationSectionSelect(params.section)
  const sectionHref = (value: string) => `/admin/configuration/${value}`

  return (
    <div class="grid min-w-0 gap-4 [&>*]:min-w-0">
      <AuthenticatedPageHeader
        description={messageTranslate("admin.organizations.configuration.placeholder")}
        title={messageTranslate("shell.nav.configuration")}
      />
      <div class="grid min-w-0 gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] [&>*]:min-w-0">
        <AuthenticatedSubNav
          active={section()}
          items={[
            {
              description: messageTranslate("admin.organizations.configuration.generalDescription"),
              href: sectionHref("general"),
              icon: mdiTuneVariant,
              label: messageTranslate("admin.organizations.configuration.general"),
              value: "general",
            },
            {
              description: messageTranslate("admin.organizations.configuration.brandingDescription"),
              href: sectionHref("branding"),
              icon: mdiPaletteOutline,
              label: messageTranslate("admin.organizations.configuration.branding"),
              value: "branding",
            },
            {
              description: messageTranslate("admin.organizations.configuration.signInDescription"),
              href: sectionHref("sign-in"),
              icon: mdiShieldLockOutline,
              label: messageTranslate("admin.organizations.configuration.signIn"),
              value: "sign-in",
            },
            {
              description: messageTranslate("admin.organizations.configuration.domainsDescription"),
              href: sectionHref("domains"),
              icon: mdiDomain,
              label: messageTranslate("admin.organizations.configuration.domains"),
              value: "domains",
            },
          ]}
          label={messageTranslate("shell.nav.configuration")}
        />
        <DirectoryAdminPlaceholder
          descriptionKey="admin.organizations.configuration.placeholder"
          titleKey="shell.nav.configuration"
        />
      </div>
    </div>
  )
}
