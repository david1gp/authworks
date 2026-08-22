import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { localeDateFormat } from "../../../ui/i18n/model/localeDateFormat.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function AccountInvitationsView(props: {
  readonly error?: string
  readonly invitations: readonly OrganizationInvitation[]
  readonly onRetry: () => void
  readonly organizationsHref: string
  readonly status: AccountAccessStatus
}) {
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={
            props.status === "empty"
              ? messageTranslate("account.access.invitationEmpty")
              : props.status === "permission-denied"
                ? messageTranslate("account.access.permission")
                : props.error
          }
          onRetry={props.status === "error" ? props.onRetry : undefined}
          state={
            props.status === "loading"
              ? "loading"
              : props.status === "empty"
                ? "empty"
                : props.status === "permission-denied" || props.status === "expired"
                  ? "inaccessible"
                  : "error"
          }
        />
      }
    >
      <section class="grid gap-4">
        <For each={props.invitations}>
          {(invitation) => (
            <article class="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 class="text-lg font-semibold">
                {messageTranslate("account.access.invitationFor", { email: invitation.email })}
              </h2>
              <p class="mt-2 break-all text-sm text-muted-foreground">{invitation.organizationId}</p>
              <p class="mt-1 text-sm text-muted-foreground">
                {messageTranslate("account.access.roles", { roles: invitation.roles.join(", ") })}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                {localeDateFormat(invitation.expiresAt, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p class="mt-4 text-xs text-muted-foreground">{messageTranslate("account.access.invitationMissing")}</p>
            </article>
          )}
        </For>
        <A class="text-sm font-medium text-accent hover:underline" href={props.organizationsHref}>
          {messageTranslate("account.access.switchOrganization")}
        </A>
      </section>
    </Show>
  )
}
