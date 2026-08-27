import { mdiApplicationOutline } from "@adaptive-ds/mdi/mdiApplicationOutline.js"
import { mdiLockOpenOutline } from "@adaptive-ds/mdi/mdiLockOpenOutline.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
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
      <section aria-labelledby="effective-access-heading" class="grid max-w-4xl gap-6 sm:gap-8">
        <div>
          <div class="flex items-center gap-2">
            <Icon class="size-5 text-accent" path={mdiLockOpenOutline} />
            <h2 class="text-xl font-semibold tracking-tight" id="effective-access-heading">
              {messageTranslate("account.access.effectiveTitle")}
            </h2>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-muted-foreground">
            {messageTranslate("account.access.effectiveDescription")}
          </p>
        </div>
        <div class="grid gap-6">
          <For each={props.groups}>
            {(group) => (
              <section class="rounded-2xl border border-line bg-surface p-6 shadow-xs transition-colors sm:p-8">
                <div class="flex items-center gap-3">
                  <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon class="size-5" path={mdiOfficeBuildingOutline} />
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold tracking-tight">{group.organization.name}</h3>
                    <p class="text-xs text-muted-foreground">
                      {messageTranslate("account.access.effectiveMembership", {
                        roles: group.entries[0]?.organization.membership.roles.join(", ") ?? "—",
                      })}
                    </p>
                  </div>
                </div>
                <div class="mt-5 grid gap-3">
                  <For each={group.entries}>
                    {(entry) => (
                      <article class="rounded-xl border border-line/70 bg-muted/40 p-4 transition-colors hover:border-line">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="flex items-start gap-2.5 min-w-0">
                            <Icon class="mt-0.5 size-4 shrink-0 text-muted-foreground" path={mdiApplicationOutline} />
                            <div>
                              <h4 class="font-medium text-foreground">
                                {entry.project?.name ?? messageTranslate("account.access.organizationAccess")}
                              </h4>
                              <p class="mt-0.5 text-xs text-muted-foreground">
                                {messageTranslate("account.access.effectiveSource", {
                                  source:
                                    entry.grant === undefined ? entry.source : `${entry.source} · ${entry.grant.id}`,
                                })}
                              </p>
                            </div>
                          </div>
                          <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300">
                            {entry.roleKeys.join(", ") || "—"}
                          </span>
                        </div>
                        <div class="mt-3 border-t border-line/50 pt-2.5">
                          <p class="text-xs font-medium text-muted-foreground">
                            {messageTranslate("account.access.effectivePermissions", {
                              permissions: entry.permissions.join(", ") || "—",
                            })}
                          </p>
                        </div>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
        <Show when={props.nextPageToken}>
          <div class="flex justify-center">
            <Button disabled={props.pendingId !== undefined} onClick={props.onLoadMore} type="button" variant="outline">
              {messageTranslate("account.access.loadMore")}
            </Button>
          </div>
        </Show>
      </section>
    </Show>
  )
}
