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
    <div class="mx-auto grid w-full max-w-7xl min-w-0 gap-8 [&>*]:min-w-0" data-account-workspace>
      <h1 class="text-xl font-semibold tracking-tight">{messageTranslate("shell.nav.account")}</h1>
      <section
        aria-labelledby="account-workspace-profile-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.profile}
      >
        <AccountSectionAnchorHeading
          description={messageTranslate("account.profile.personalDescription")}
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
          description={messageTranslate("account.factors.description")}
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
          description={messageTranslate("account.sessions.description")}
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
          description={messageTranslate("account.access.effectiveDescription")}
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
          description={messageTranslate("account.delete.warning")}
          id={accountWorkspaceSectionIds.dangerZone}
          title={messageTranslate("account.delete.dangerZone")}
        />
        {props.dangerZone}
      </section>
    </div>
  )
}
