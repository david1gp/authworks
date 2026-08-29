import type { JSX } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
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
        <h2 class="text-lg font-semibold tracking-tight" id="account-workspace-profile-title">
          {messageTranslate("shell.nav.profile")}
        </h2>
        {props.profile}
      </section>

      <section
        aria-labelledby="account-workspace-security-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.security}
      >
        <h2 class="text-lg font-semibold tracking-tight" id="account-workspace-security-title">
          {messageTranslate("shell.nav.security")}
        </h2>
        {props.security}
      </section>

      <section
        aria-labelledby="account-workspace-devices-applications-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.devicesApplications}
      >
        <h2 class="text-lg font-semibold tracking-tight" id="account-workspace-devices-applications-title">
          {messageTranslate("shell.nav.sessionsDevices")} · {messageTranslate("shell.nav.applications")}
        </h2>
        {props.devicesApplications}
      </section>

      <section
        aria-labelledby="account-workspace-access-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.access}
      >
        <h2 class="text-lg font-semibold tracking-tight" id="account-workspace-access-title">
          {messageTranslate("shell.nav.access")}
        </h2>
        {props.access}
      </section>

      <section
        aria-labelledby="account-workspace-danger-zone-title"
        class="grid scroll-mt-24 gap-3"
        id={accountWorkspaceSectionIds.dangerZone}
      >
        <h2 class="text-lg font-semibold tracking-tight" id="account-workspace-danger-zone-title">
          {messageTranslate("account.delete.dangerZone")}
        </h2>
        {props.dangerZone}
      </section>
    </div>
  )
}
