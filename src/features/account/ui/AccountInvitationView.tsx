import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationInvitationMeInspectResponse } from "../../organizations/public/organizationInvitationMeInspectResponseSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountInvitationViewStateCreate } from "./accountInvitationViewStateCreate.js"

export function AccountInvitationView(props: {
  readonly error?: string
  readonly invitation?: OrganizationInvitationMeInspectResponse["invitation"]
  readonly onAccept: () => void
  readonly onDecline: () => void
  readonly onRetry: () => void
  readonly organizationsHref?: string
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  const state = accountInvitationViewStateCreate({
    error: () => props.error,
    organizationsHref: () => props.organizationsHref,
    status: () => props.status,
  })
  return (
    <div class="grid min-w-0 gap-3">
      <Show
        when={props.status !== "accepted" && props.status !== "declined"}
        fallback={
          <ProductionStatePanel
            detail={messageTranslate(
              props.status === "accepted" ? "account.access.acceptedDetail" : "account.access.declinedDetail",
            )}
            state="empty"
            title={messageTranslate(
              props.status === "accepted" ? "account.access.accepted" : "account.access.declined",
            )}
          />
        }
      >
        <section aria-label={messageTranslate("shell.nav.invitations")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <p class="text-sm text-muted-foreground">{messageTranslate("account.access.invitationDescription")}</p>

          <AccountStateBoundary
            detail={state.boundary().detail}
            onRetry={props.onRetry}
            state={
              props.invitation === undefined && state.boundary().state === "ready" ? "loading" : state.boundary().state
            }
            title={state.boundary().title}
          >
            <Show when={props.invitation}>
              {(invitation) => (
                <AuthenticatedSection padded title={invitation().organizationName ?? invitation().organizationId}>
                  <AuthenticatedFieldList
                    columns={3}
                    fields={[
                      { label: messageTranslate("account.access.email"), value: invitation().email },
                      {
                        label: messageTranslate("account.access.membership"),
                        value: <AccountRoleList values={invitation().roles} />,
                      },
                      {
                        label: messageTranslate("admin.organizations.invitations.expires"),
                        value: localeDateFormat(invitation().expiresAt, { dateStyle: "long", timeStyle: "short" }),
                      },
                    ]}
                  />
                  <div class="mt-3 flex flex-wrap gap-2">
                    <AuthenticatedButton
                      disabled={props.pendingId !== undefined}
                      icon={mdiCheck}
                      onClick={props.onAccept}
                      size="sm"
                    >
                      {messageTranslate("common.continue")}
                    </AuthenticatedButton>
                    <AuthenticatedButton
                      class={authenticatedDangerOutlineButtonClass}
                      disabled={props.pendingId !== undefined}
                      icon={mdiClose}
                      onClick={props.onDecline}
                      size="sm"
                      variant="outline"
                    >
                      {messageTranslate("common.decline")}
                    </AuthenticatedButton>
                  </div>
                </AuthenticatedSection>
              )}
            </Show>
          </AccountStateBoundary>
        </section>
      </Show>
      <Show when={state.continuationVisible()}>
        <A
          class="w-fit rounded-control px-3 py-2 text-sm text-accent hover:bg-surface-hover"
          href={state.continuationHref()}
        >
          {messageTranslate("shell.nav.organizations")}
        </A>
      </Show>
    </div>
  )
}
