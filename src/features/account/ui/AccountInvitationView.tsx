import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
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
                props.status === "expired" || props.status === "replayed" || props.status === "permission-denied"
                  ? undefined
                  : props.error === "missing-token"
                    ? messageTranslate("account.access.invitationMissing")
                    : props.error
              }
              onRetry={props.status === "error" ? props.onRetry : undefined}
              state={props.status === "loading" ? "loading" : props.status === "error" ? "error" : "inaccessible"}
              title={
                props.status === "expired"
                  ? messageTranslate("account.access.expired")
                  : props.status === "replayed"
                    ? messageTranslate("account.access.invitationReplay")
                    : props.status === "permission-denied"
                      ? messageTranslate("account.access.permission")
                      : undefined
              }
            />
          }
        >
          <section
            class="max-w-xl mx-auto rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            role="status"
          >
            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60">
              <Icon class="size-6 text-emerald-700 dark:text-emerald-300" path={mdiCheckCircleOutline} />
            </div>
            <h2 class="mt-4 text-xl font-semibold tracking-tight">
              {messageTranslate(props.status === "accepted" ? "account.access.accepted" : "account.access.declined")}
            </h2>
          </section>
        </Show>
      }
    >
      <section class="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
        <div class="flex items-center gap-2">
          <Icon class="size-5 text-accent" path={mdiEmailPlusOutline} />
          <p class="text-sm font-medium text-muted-foreground">
            {messageTranslate("account.access.invitationDescription")}
          </p>
        </div>
        <h2 class="mt-3 break-all text-2xl font-bold tracking-tight text-foreground">
          {props.invitation?.organizationId}
        </h2>
        <dl class="mt-6 grid gap-4 rounded-xl border border-line/70 bg-muted/40 p-4 sm:grid-cols-2">
          <div class="rounded-lg bg-surface p-3.5 shadow-2xs">
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {messageTranslate("account.access.email")}
            </dt>
            <dd class="mt-1 break-all text-sm font-medium">{props.invitation?.email}</dd>
          </div>
          <div class="rounded-lg bg-surface p-3.5 shadow-2xs">
            <dt class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {messageTranslate("account.access.membership")}
            </dt>
            <dd class="mt-1 text-sm font-medium">
              <div class="flex flex-wrap gap-1">
                <For each={props.invitation?.roles ?? []}>
                  {(role) => (
                    <span class="rounded-md border border-line bg-muted/60 px-2 py-0.5 text-xs font-medium">
                      {role}
                    </span>
                  )}
                </For>
              </div>
            </dd>
          </div>
        </dl>
        <p class="mt-4 text-xs text-muted-foreground">
          {props.invitation
            ? localeDateFormat(props.invitation.expiresAt, { dateStyle: "long", timeStyle: "short" })
            : ""}
        </p>
        <div class="mt-7 flex flex-wrap gap-3">
          <Button disabled={props.pendingId !== undefined} onClick={props.onAccept} variant="filledBlue">
            <Icon class="mr-1.5 size-4" path={mdiCheckCircleOutline} />
            {messageTranslate("common.continue")}
          </Button>
          <Button disabled={props.pendingId !== undefined} onClick={props.onDecline} variant="outlineRed">
            <Icon class="mr-1.5 size-4" path={mdiClose} />
            {messageTranslate("common.decline")}
          </Button>
        </div>
      </section>
    </Show>
  )
}
