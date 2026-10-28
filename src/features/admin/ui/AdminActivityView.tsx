import { For, Show } from "solid-js"
import { CodeBlock } from "#ui/static/code/CodeBlock.jsx"
import { AuthenticatedPageHeader } from "../../../ui/authenticated/AuthenticatedPageHeader.js"
import { AuthenticatedPagination } from "../../../ui/authenticated/AuthenticatedPagination.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"
import { adminActivityViewStateCreate } from "./adminActivityViewStateCreate.js"

export function AdminActivityView(props: Parameters<typeof adminActivityViewStateCreate>[0]) {
  const state = adminActivityViewStateCreate(props)
  return (
    <div class="grid min-w-0 gap-5">
      <AuthenticatedPageHeader
        title={messageTranslate("shell.nav.activity")}
        eyebrow={`${state.scope()} · ${state.contextLabel()}`}
        description={messageTranslate("admin.activity.description")}
      />
      <AuthenticatedSection label={messageTranslate("shell.nav.activity")}>
        <div aria-busy={state.status() === "loading"} aria-live="polite">
          <Show
            when={state.status() === "ready"}
            fallback={
              <ProductionStatePanel
                compact
                state={state.panelState()}
                detail={state.panelDetail()}
                onRetry={state.status() === "error" ? state.retry : undefined}
              />
            }
          >
            <ol class="divide-y divide-line-subtle">
              <For each={state.rows()}>
                {(row) => (
                  <li class="grid min-w-0 gap-3 px-5 py-4">
                    <div class="flex flex-wrap items-start justify-between gap-x-5 gap-y-1">
                      <div class="min-w-0">
                        <h2 class="break-words text-sm font-medium">{row.label}</h2>
                        <p class="mt-1 text-xs text-muted-foreground">
                          {row.subject} · <span title={row.actorId}>{row.actor}</span>
                        </p>
                      </div>
                      <time class="text-xs tabular-nums text-muted-foreground" datetime={row.datetime}>
                        {row.timestamp}
                      </time>
                    </div>
                    <details class="min-w-0 text-xs">
                      <summary class="w-fit cursor-pointer rounded-control text-accent focus-visible:outline-2 focus-visible:outline-accent">
                        {messageTranslate("admin.events.show")}
                      </summary>
                      <p class="my-2 text-muted-foreground">{messageTranslate("admin.events.redactionNotice")}</p>
                      <div class="max-h-80 overflow-auto">
                        <CodeBlock data={row.details} />
                      </div>
                    </details>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </div>
        <AuthenticatedPagination
          nextAvailable={state.status() !== "loading" && state.hasNextPage()}
          previousAvailable={state.status() !== "loading" && state.hasPreviousPage()}
          onNext={state.pageNext}
          onPrevious={state.pagePrevious}
          summary={state.count()}
        />
      </AuthenticatedSection>
    </div>
  )
}
