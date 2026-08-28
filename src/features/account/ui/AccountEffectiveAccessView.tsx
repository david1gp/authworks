import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
import { AccountStateBoundary } from "./AccountStateBoundary.js"
import { accountAccessBoundaryStateGet } from "./accountAccessBoundaryStateGet.js"
import { accountEffectiveAccessSourceGet } from "./accountEffectiveAccessSourceGet.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

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
              <AuthenticatedSection
                description={messageTranslate("account.access.effectiveMembership", {
                  roles: group.entries[0]?.organization.membership.roles.join(", ") ?? "",
                })}
                title={group.organization.name}
              >
                {/* Every grant is a short technical record, so a stacked list stays readable at any width. */}
                <ul class="divide-y divide-line-subtle">
                  <For each={group.entries}>
                    {(entry) => (
                      <li class="grid min-w-0 gap-1 px-3 py-2.5">
                        <h3 class="min-w-0 truncate text-sm font-medium">
                          {entry.project?.name ?? messageTranslate("account.access.organizationAccess")}
                        </h3>
                        <p class="min-w-0 text-xs text-muted-foreground">
                          {messageTranslate("account.access.roles", { roles: entry.roleKeys.join(", ") })}
                        </p>
                        <p class="min-w-0 text-xs text-muted-foreground">
                          {messageTranslate("account.access.effectivePermissions", {
                            permissions: entry.permissions.join(", "),
                          })}
                        </p>
                        <p class="min-w-0 truncate font-mono text-xs text-muted-foreground">
                          {messageTranslate("account.access.effectiveSource", {
                            source: accountEffectiveAccessSourceGet(entry),
                          })}
                        </p>
                      </li>
                    )}
                  </For>
                </ul>
              </AuthenticatedSection>
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
