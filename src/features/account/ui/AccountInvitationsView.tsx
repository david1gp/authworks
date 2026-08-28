import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedPageBody } from "../../../ui/authenticated/AuthenticatedPageBody.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function AccountInvitationsView(props: {
  readonly error?: string
  readonly invitationHref?: string
  readonly invitations: readonly OrganizationInvitation[]
  readonly onRetry: () => void
  readonly organizationsHref: string
  readonly status: AccountAccessStatus
}) {
  const boundary = () =>
    accountAccessBoundaryStateGet(props.status, {
      emptyDetail: messageTranslate("account.access.invitationEmpty"),
      error: props.error,
    })
  return (
    <AuthenticatedPageBody>
      <p class="text-sm text-muted-foreground">{messageTranslate("account.access.invitationDescription")}</p>

      <AccountStateBoundary detail={boundary().detail} onRetry={props.onRetry} state={boundary().state}>
        <AuthenticatedSection label={messageTranslate("shell.nav.invitations")}>
          <ul class="divide-y divide-line-subtle">
            <For each={props.invitations}>
              {(invitation) => (
                <li class="grid min-w-0 gap-2 px-3 py-2.5">
                  <h2 class="min-w-0 truncate text-sm font-medium">
                    {messageTranslate("account.access.invitationFor", { email: invitation.email })}
                  </h2>
                  <AuthenticatedFieldList
                    columns={3}
                    fields={[
                      {
                        identifier: true,
                        label: messageTranslate("admin.impersonation.organization"),
                        value: invitation.organizationId,
                      },
                      {
                        label: messageTranslate("account.access.membership"),
                        value: <AccountRoleList values={invitation.roles} />,
                      },
                      {
                        label: messageTranslate("admin.organizations.invitations.expires"),
                        value: localeDateFormat(invitation.expiresAt, { dateStyle: "medium", timeStyle: "short" }),
                      },
                    ]}
                  />
                  {/* An overview entry is only actionable where a destination exists; production
                      accept links carry a token this listing never receives. */}
                  <Show
                    fallback={
                      <p class="text-xs text-muted-foreground">
                        {messageTranslate("account.access.invitationMissing")}
                      </p>
                    }
                    when={props.invitationHref}
                  >
                    {(href) => (
                      <div>
                        <A class="text-sm font-medium text-accent hover:underline" href={href()}>
                          {messageTranslate("account.access.invitationOpen")}
                        </A>
                      </div>
                    )}
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </AuthenticatedSection>
      </AccountStateBoundary>

      <div>
        <A class="text-sm font-medium text-accent hover:underline" href={props.organizationsHref}>
          {messageTranslate("account.access.switchOrganization")}
        </A>
      </div>
    </AuthenticatedPageBody>
  )
}
