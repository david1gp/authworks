import type { JSX } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountSectionAnchorHeading } from "./AccountSectionAnchorHeading.js"
import { accountWorkspaceSectionIds } from "./accountWorkspaceSectionIds.js"

export function AccountWorkspace(props: {
  readonly access: JSX.Element
  readonly dangerZone: JSX.Element
  readonly devicesApplications: JSX.Element
  readonly profile: JSX.Element
  readonly security: JSX.Element
}) {
  return (
    <div class="grid min-w-0 gap-8 [&>*]:min-w-0" data-account-workspace>
      <h1 class="text-xl font-semibold tracking-tight">{messageTranslate("shell.nav.account")}</h1>
      <section
        aria-labelledby="account-workspace-profile-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.profile}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.profile}
          title={messageTranslate("shell.nav.profile")}
        />
        {props.profile}
      </section>

      <section
        aria-labelledby="account-workspace-security-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.security}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.security}
          title={messageTranslate("shell.nav.security")}
        />
        {props.security}
      </section>

      <section
        aria-labelledby="account-workspace-devices-applications-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.devicesApplications}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.devicesApplications}
          title={`${messageTranslate("shell.nav.securityHistory")} · ${messageTranslate("shell.nav.sessionsDevices")} · ${messageTranslate("shell.nav.applications")}`}
        />
        {props.devicesApplications}
      </section>

      <section
        aria-labelledby="account-workspace-access-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.access}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.access}
          title={messageTranslate("shell.nav.access")}
        />
        {props.access}
      </section>

      <section
        aria-labelledby="account-workspace-danger-zone-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.dangerZone}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.dangerZone}
          title={messageTranslate("account.delete.dangerZone")}
        />
        {props.dangerZone}
      </section>
    </div>
  )
}
