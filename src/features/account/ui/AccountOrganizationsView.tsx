import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { AccountRoleList } from "./AccountRoleList.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
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
  const boundary = () =>
    accountAccessBoundaryStateGet(props.status, {
      emptyDetail: messageTranslate("account.access.organizationEmpty"),
      error: props.error,
    })
  return (
    <section
      aria-label={messageTranslate("account.access.switchOrganization")}
      class="grid min-w-0 gap-3 [&>*]:min-w-0"
    >
      <p class="text-sm text-muted-foreground">{messageTranslate("account.access.organizationDescription")}</p>

      <Show when={props.notice}>
        {(organization) => (
          <AuthenticatedNotice
            message={messageTranslate("account.access.switched", { organization: organization() })}
          />
        )}
      </Show>

      <AccountStateBoundary detail={boundary().detail} onRetry={props.onRetry} state={boundary().state}>
        {/* Two organizations fit a desktop row while a phone keeps one readable column. */}
        <ul
          aria-label={messageTranslate("account.access.switchOrganization")}
          class="grid min-w-0 gap-3 lg:grid-cols-2 [&>*]:min-w-0"
        >
          <For each={props.organizations}>
            {(item) => {
              const active = () => item.organization.id === props.activeOrganizationId
              return (
                <li class="min-w-0">
                  <AuthenticatedSection class="h-full" padded>
                    <div class="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                      <div class="min-w-0 flex-1">
                        <h2 class="min-w-0 truncate text-sm font-semibold tracking-tight">{item.organization.name}</h2>
                        <p class="mt-0.5 min-w-0 truncate font-mono text-xs text-muted-foreground">
                          {item.organization.id}
                        </p>
                      </div>
                      <Show when={active()}>
                        <AuthenticatedStatus label={messageTranslate("account.access.active")} tone="accent" />
                      </Show>
                    </div>
                    <div class="mt-2 grid gap-1">
                      <p class="text-2xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                        {messageTranslate("account.access.membership")}
                      </p>
                      <AccountRoleList values={item.membership.roles} />
                    </div>
                    <div class="mt-2.5">
                      <Button
                        disabled={active() || props.pendingId !== undefined}
                        onClick={() => props.onSwitch(item.organization.id)}
                        size="sm"
                        variant="outline"
                      >
                        {messageTranslate("account.access.switchOrganization")}
                      </Button>
                    </div>
                  </AuthenticatedSection>
                </li>
              )
            }}
          </For>
        </ul>
      </AccountStateBoundary>
    </section>
  )
}
