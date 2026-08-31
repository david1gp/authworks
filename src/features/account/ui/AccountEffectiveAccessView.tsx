import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"
import { accountEffectiveAccessSourceGet } from "./accountEffectiveAccessSourceGet.js"

export function AccountEffectiveAccessView(props: {
  readonly error?: string
  readonly groups: readonly AccountEffectiveAccessGroup[]
  readonly nextPageToken?: string
  readonly onLoadMore: () => void
  readonly onRetry: () => void
  readonly pendingId?: string
  readonly status: AccountAccessStatus
}) {
  const boundary = () =>
    accountAccessBoundaryStateGet(props.status, {
      emptyDetail: messageTranslate("account.access.effectiveEmpty"),
      error: props.error,
    })
  return (
    <section aria-label={messageTranslate("account.access.effectiveTitle")} class="grid min-w-0 gap-3 [&>*]:min-w-0">
      <p class="text-sm text-muted-foreground">{messageTranslate("account.access.effectiveDescription")}</p>

      <AccountStateBoundary detail={boundary().detail} onRetry={props.onRetry} state={boundary().state}>
        <div class="grid min-w-0 gap-3 [&>*]:min-w-0">
          <For each={props.groups}>
            {(group) => (
              <fieldset class="min-w-0 rounded-panel border border-line px-3 pb-1">
                <legend class="max-w-full px-1 text-sm font-semibold tracking-tight">
                  <span class="block truncate">{group.organization.name}</span>
                </legend>
                <p class="px-1 pb-2 text-xs text-muted-foreground">
                  {messageTranslate("account.access.effectiveMembership", {
                    roles: group.entries[0]?.organization.membership.roles.join(", ") ?? "",
                  })}
                </p>
                <ul class="min-w-0 divide-y divide-line-subtle">
                  <For each={group.entries}>
                    {(entry) => {
                      const source = () => accountEffectiveAccessSourceGet(entry)
                      return (
                        <li class="grid min-w-0 gap-x-5 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div class="min-w-0">
                            <h3 class="min-w-0 truncate text-sm font-semibold tracking-tight">
                              {entry.project?.name ?? messageTranslate("account.access.organizationAccess")}
                            </h3>
                            <p class="mt-1 min-w-0 text-xs text-muted-foreground">
                              {messageTranslate("account.access.roles", { roles: entry.roleKeys.join(", ") })}
                            </p>
                            <p class="mt-0.5 min-w-0 truncate font-mono text-xs text-muted-foreground">
                              {messageTranslate("account.access.effectiveSource", { source: source() })}
                            </p>
                          </div>
                          <div class="min-w-0 md:self-center">
                            <AccountDisclosure
                              summary={messageTranslate("account.access.permissionsToggle", {
                                count: String(entry.permissions.length),
                                source: source(),
                              })}
                            >
                              <p class="min-w-0 text-xs text-muted-foreground">
                                {messageTranslate("account.access.effectivePermissions", {
                                  permissions: entry.permissions.join(", "),
                                })}
                              </p>
                            </AccountDisclosure>
                          </div>
                        </li>
                      )
                    }}
                  </For>
                </ul>
              </fieldset>
            )}
          </For>

          <Show when={props.nextPageToken}>
            <div>
              <Button
                disabled={props.pendingId !== undefined}
                onClick={props.onLoadMore}
                size="sm"
                type="button"
                variant="outline"
              >
                {messageTranslate("account.access.loadMore")}
              </Button>
            </div>
          </Show>
        </div>
      </AccountStateBoundary>
    </section>
  )
}
