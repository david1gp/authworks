import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
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
  return (
    <Show
      when={props.status === "ready" && props.invitation !== undefined}
      fallback={
        <Show
          when={props.status === "accepted" || props.status === "declined"}
          fallback={
            <ProductionStatePanel
              detail={
                props.status === "expired"
                  ? messageTranslate("account.access.expired")
                  : props.status === "replayed"
                    ? messageTranslate("account.access.invitationReplay")
                    : props.status === "permission-denied"
                      ? messageTranslate("account.access.permission")
                      : props.error === "missing-token"
                        ? messageTranslate("account.access.invitationMissing")
                        : props.error
              }
              onRetry={props.status === "error" ? props.onRetry : undefined}
              state={props.status === "loading" ? "loading" : props.status === "error" ? "error" : "inaccessible"}
            />
          }
        >
          <section class="rounded-xl border border-green-300 bg-green-50 p-8 text-center text-green-950" role="status">
            <h2 class="text-xl font-semibold">
              {messageTranslate(props.status === "accepted" ? "account.access.accepted" : "account.access.declined")}
            </h2>
          </section>
        </Show>
      }
    >
      <section class="max-w-2xl rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <p class="text-sm text-muted-foreground">{messageTranslate("account.access.invitationDescription")}</p>
        <h2 class="mt-3 break-all text-2xl font-semibold">{props.invitation?.organizationId}</h2>
        <dl class="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {messageTranslate("account.access.email")}
            </dt>
            <dd class="mt-1 break-all">{props.invitation?.email}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {messageTranslate("account.access.membership")}
            </dt>
            <dd class="mt-1">{props.invitation?.roles.join(", ")}</dd>
          </div>
        </dl>
        <p class="mt-5 text-sm text-muted-foreground">
          {props.invitation
            ? localeDateFormat(props.invitation.expiresAt, { dateStyle: "long", timeStyle: "short" })
            : ""}
        </p>
        <div class="mt-7 flex flex-wrap gap-3">
          <Button disabled={props.pendingId !== undefined} onClick={props.onAccept} variant="filledBlue">
            {messageTranslate("common.continue")}
          </Button>
          <Button disabled={props.pendingId !== undefined} onClick={props.onDecline} variant="outlineRed">
            {messageTranslate("common.decline")}
          </Button>
        </div>
      </section>
    </Show>
  )
}
