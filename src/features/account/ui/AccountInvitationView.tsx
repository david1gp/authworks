import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { Show } from "solid-js"
import { ButtonIcon } from "#ui/interactive/button/ButtonIcon.jsx"
import { AuthenticatedFieldList } from "../../../ui/authenticated/AuthenticatedFieldList.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedDangerOutlineButtonClass } from "../../../ui/authenticated/authenticatedDangerOutlineButtonClass.js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountInvitationBoundaryStateGet } from "./accountInvitationBoundaryStateGet.js"

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
                  <ButtonIcon disabled={props.pendingId !== undefined} icon={mdiCheck} onClick={props.onAccept}>
                    {messageTranslate("common.continue")}
                  </ButtonIcon>
                  <ButtonIcon
                    class={authenticatedDangerOutlineButtonClass}
                    disabled={props.pendingId !== undefined}
                    icon={mdiClose}
                    onClick={props.onDecline}
                    variant="outline"
                  >
                    {messageTranslate("common.decline")}
                  </ButtonIcon>
                </div>
              </AuthenticatedSection>
            )}
          </Show>
        </AccountStateBoundary>
      </section>
    </Show>
  )
}
