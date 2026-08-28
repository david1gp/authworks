import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountInvitationBoundaryStateGet } from "./accountInvitationBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function AccountInvitationView(props: {
  readonly error?: string
  readonly invitation?: OrganizationInvitation
  readonly onAccept: () => void
  readonly onDecline: () => void
  readonly onRetry: () => void
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  const boundary = () => accountInvitationBoundaryStateGet(props.status, props.error)
  return (
    <Show
      when={props.status !== "accepted" && props.status !== "declined"}
      fallback={
        <ProductionStatePanel
          state="empty"
          title={messageTranslate(props.status === "accepted" ? "account.access.accepted" : "account.access.declined")}
        />
      }
    >
      <section aria-label={messageTranslate("shell.nav.invitations")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
        <p class="text-sm text-muted-foreground">{messageTranslate("account.access.invitationDescription")}</p>

        <AccountStateBoundary
          detail={boundary().detail}
          onRetry={props.onRetry}
          state={props.invitation === undefined && boundary().state === "ready" ? "loading" : boundary().state}
          title={boundary().title}
        >
          <Show when={props.invitation}>
            {(invitation) => (
              <AuthenticatedSection padded title={invitation().organizationId}>
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
                  <Button disabled={props.pendingId !== undefined} onClick={props.onAccept} size="sm">
                    {messageTranslate("common.continue")}
                  </Button>
                  <Button
                    class={authenticatedDangerOutlineButtonClass}
                    disabled={props.pendingId !== undefined}
                    onClick={props.onDecline}
                    size="sm"
                    variant="outline"
                  >
                    {messageTranslate("common.decline")}
                  </Button>
                </div>
              </AuthenticatedSection>
            )}
          </Show>
        </AccountStateBoundary>
      </section>
    </Show>
  )
}
