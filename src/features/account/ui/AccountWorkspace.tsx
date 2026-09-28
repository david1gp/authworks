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
    <div
      class="mx-auto grid w-full max-w-7xl min-w-0 gap-6 pb-8 sm:gap-8 sm:pb-12 [&>*]:min-w-0"
      data-account-workspace
    >
      <h1 class="text-xl font-semibold tracking-tight">{messageTranslate("shell.nav.account")}</h1>
      <section
        aria-labelledby="account-workspace-profile-title"
        class="grid min-w-0 scroll-mt-24 gap-3 sm:gap-4 [&>*]:min-w-0"
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
        class="grid min-w-0 scroll-mt-24 gap-3 sm:gap-4 [&>*]:min-w-0"
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
        class="grid min-w-0 scroll-mt-24 gap-3 sm:gap-4 [&>*]:min-w-0"
        id={accountWorkspaceSectionIds.devicesApplications}
      >
        <AccountSectionAnchorHeading
          id={accountWorkspaceSectionIds.devicesApplications}
          title={messageTranslate("account.workspace.devicesTitle")}
        />
        {props.devicesApplications}
      </section>

      <section
        aria-labelledby="account-workspace-access-title"
        class="grid min-w-0 scroll-mt-24 gap-3 sm:gap-4 [&>*]:min-w-0"
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
        class="grid min-w-0 scroll-mt-24 gap-3 sm:gap-4 [&>*]:min-w-0"
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
