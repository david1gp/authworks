import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiEmailPlusOutline } from "@adaptive-ds/mdi/mdiEmailPlusOutline.js"
import { A } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
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
      <section class="grid max-w-4xl gap-6 sm:gap-8">
        <div>
          <div class="flex items-center gap-2">
            <Icon class="size-5 text-accent" path={mdiEmailPlusOutline} />
            <h2 class="text-xl font-semibold tracking-tight">{messageTranslate("shell.nav.invitations")}</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.access.invitationDescription")}</p>
        </div>
        <div class="grid gap-4">
          <For each={props.invitations}>
            {(invitation) => (
              <article class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors hover:border-line-strong/60">
                <div class="flex items-start gap-3.5">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon class="size-5" path={mdiEmailOutline} />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-lg font-semibold tracking-tight text-foreground">
                      {messageTranslate("account.access.invitationFor", { email: invitation.email })}
                    </h3>
                    <p class="mt-1 break-all font-mono text-xs text-muted-foreground">{invitation.organizationId}</p>
                    <div class="mt-2.5 flex flex-wrap gap-1.5">
                      <For each={invitation.roles}>
                        {(role) => (
                          <span class="rounded-md border border-line bg-muted/60 px-2 py-0.5 text-xs font-medium">
                            {role}
                          </span>
                        )}
                      </For>
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">
                      {localeDateFormat(invitation.expiresAt, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p class="mt-3 text-xs text-muted-foreground/80">
                      {messageTranslate("account.access.invitationMissing")}
                    </p>
                  </div>
                </div>
              </article>
            )}
          </For>
        </div>
        <div>
          <A
            class="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            href={props.organizationsHref}
          >
            <span>←</span>
            <span>{messageTranslate("account.access.switchOrganization")}</span>
          </A>
        </div>
      </section>
    </Show>
  )
}
