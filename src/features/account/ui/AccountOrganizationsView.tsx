import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

export function AccountOrganizationsView(props: {
  readonly activeOrganizationId?: string
  readonly error?: string
  readonly notice?: string
  readonly onRetry: () => void
  readonly onSwitch: (organizationId: string) => void
  readonly organizations: readonly OrganizationMe[]
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={
            props.status === "empty"
              ? messageTranslate("account.access.organizationEmpty")
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
      <section aria-labelledby="organizations-heading" class="grid max-w-4xl gap-6 sm:gap-8">
        <div>
          <div class="flex items-center gap-2">
            <Icon class="size-5 text-accent" path={mdiOfficeBuildingOutline} />
            <h2 class="text-xl font-semibold tracking-tight" id="organizations-heading">
              {messageTranslate("account.access.switchOrganization")}
            </h2>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
            {messageTranslate("account.access.organizationDescription")}
          </p>
        </div>
        <Show when={props.notice}>
          {(organization) => (
            <div
              class="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              role="status"
            >
              <Icon class="size-4 shrink-0" path={mdiCheckCircleOutline} />
              <span>{messageTranslate("account.access.switched", { organization: organization() })}</span>
            </div>
          )}
        </Show>
        <div class="grid gap-5 sm:grid-cols-2">
          <For each={props.organizations}>
            {(item) => {
              const active = () => item.organization.id === props.activeOrganizationId
              return (
                <article
                  class={`flex flex-col justify-between rounded-2xl border bg-surface p-6 shadow-xs transition-colors ${
                    active() ? "border-accent ring-1 ring-accent/30" : "border-line hover:border-line-strong/60"
                  }`}
                >
                  <div>
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Icon class="size-5" path={mdiOfficeBuildingOutline} />
                        </div>
                        <div>
                          <h3 class="text-lg font-semibold tracking-tight">{item.organization.name}</h3>
                          <p class="font-mono text-xs text-muted-foreground">{item.organization.id}</p>
                        </div>
                      </div>
                      <Show when={active()}>
                        <span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300">
                          <Icon class="size-3" path={mdiCheckCircleOutline} />
                          {messageTranslate("account.access.active")}
                        </span>
                      </Show>
                    </div>
                    <div class="mt-4">
                      <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {messageTranslate("account.access.membership")}
                      </p>
                      <div class="mt-1.5 flex flex-wrap gap-1.5">
                        <For each={item.membership.roles}>
                          {(role) => (
                            <span class="rounded-md border border-line bg-muted/60 px-2 py-0.5 text-xs font-medium">
                              {role}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                  <div class="pt-5">
                    <Button
                      class="w-full"
                      disabled={active() || props.pendingId !== undefined}
                      onClick={() => props.onSwitch(item.organization.id)}
                      variant={active() ? "filled" : "outline"}
                    >
                      {messageTranslate("account.access.switchOrganization")}
                    </Button>
                  </div>
                </article>
              )
            }}
          </For>
        </div>
      </section>
    </Show>
  )
}
