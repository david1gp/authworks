import { For, Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"
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
  return (
    <Show
      when={props.status === "ready"}
      fallback={
        <ProductionStatePanel
          detail={props.status === "empty" ? messageTranslate("account.access.effectiveEmpty") : props.error}
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
      <section aria-labelledby="effective-access-heading" class="grid gap-5">
        <div>
          <h2 class="text-xl font-semibold" id="effective-access-heading">
            {messageTranslate("account.access.effectiveTitle")}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">{messageTranslate("account.access.effectiveDescription")}</p>
        </div>
        <div class="grid gap-4">
          <For each={props.groups}>
            {(group) => (
              <section class="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h3 class="text-lg font-semibold">{group.organization.name}</h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  {messageTranslate("account.access.effectiveMembership", {
                    roles: group.entries[0]?.organization.membership.roles.join(", ") ?? "—",
                  })}
                </p>
                <div class="mt-4 grid gap-3">
                  <For each={group.entries}>
                    {(entry) => (
                      <article class="rounded-lg border border-line/70 bg-background p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 class="font-medium">
                              {entry.project?.name ?? messageTranslate("account.access.organizationAccess")}
                            </h4>
                            <p class="mt-1 text-xs text-muted-foreground">
                              {messageTranslate("account.access.effectiveSource", {
                                source:
                                  entry.grant === undefined ? entry.source : `${entry.source} · ${entry.grant.id}`,
                              })}
                            </p>
                          </div>
                          <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                            {entry.roleKeys.join(", ") || "—"}
                          </span>
                        </div>
                        <p class="mt-3 text-sm text-muted-foreground">
                          {messageTranslate("account.access.effectivePermissions", {
                            permissions: entry.permissions.join(", ") || "—",
                          })}
                        </p>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
        <Show when={props.nextPageToken}>
          <button
            class="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            disabled={props.pendingId !== undefined}
            onClick={props.onLoadMore}
            type="button"
          >
            {messageTranslate("account.access.loadMore")}
          </button>
        </Show>
      </section>
    </Show>
  )
}
