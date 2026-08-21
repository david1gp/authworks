import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
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
      <section aria-labelledby="organizations-heading" class="grid gap-5">
        <div>
          <h2 class="text-xl font-semibold" id="organizations-heading">
            {messageTranslate("account.access.switchOrganization")}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.access.organizationDescription")}</p>
        </div>
        <Show when={props.notice}>
          {(organization) => (
            <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
              {messageTranslate("account.access.switched", { organization: organization() })}
            </p>
          )}
        </Show>
        <div class="grid gap-4 lg:grid-cols-2">
          <For each={props.organizations}>
            {(item) => {
              const active = () => item.organization.id === props.activeOrganizationId
              return (
                <article class="rounded-xl border border-line bg-surface p-5 shadow-sm">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h3 class="text-lg font-semibold">{item.organization.name}</h3>
                      <p class="mt-2 text-sm text-muted-foreground">
                        {messageTranslate("account.access.roles", { roles: item.membership.roles.join(", ") })}
                      </p>
                    </div>
                    <Show when={active()}>
                      <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {messageTranslate("account.access.active")}
                      </span>
                    </Show>
                  </div>
                  <Button
                    class="mt-5"
                    disabled={active() || props.pendingId !== undefined}
                    onClick={() => props.onSwitch(item.organization.id)}
                    variant="outline"
                  >
                    {messageTranslate("account.access.switchOrganization")}
                  </Button>
                </article>
              )
            }}
          </For>
        </div>
      </section>
    </Show>
  )
}
