import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { LoaderSpin4Square } from "#ui/static/loaders/LoaderSpin4Square.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ProductionStatePanel } from "../../../ui/production/ProductionStatePanel.js"

/**
 * Shared loading, empty, error, and inaccessible frame for the self-service account pages. Loading
 * keeps an explicit `status` role so a screen reader announces the pending fetch, which the shared
 * panel cannot express because its polite live region carries no role of its own.
 */
export function AccountStateBoundary(props: {
  readonly children: JSX.Element
  readonly detail?: string
  readonly onRetry?: () => void
  readonly state: "empty" | "error" | "inaccessible" | "loading" | "ready"
  readonly title?: string
}) {
  return (
    <Show
      when={props.state === "ready"}
      fallback={
        <Show
          when={props.state === "loading"}
          fallback={
            <ProductionStatePanel
              detail={props.detail}
              onRetry={props.state === "error" ? props.onRetry : undefined}
              state={props.state === "empty" ? "empty" : props.state === "inaccessible" ? "inaccessible" : "error"}
              title={props.title}
            />
          }
        >
          <div
            class="grid min-h-40 place-items-center rounded-panel border border-line bg-surface px-4 py-8 text-center"
            data-content-state="loading"
            role="status"
          >
            <div>
              <LoaderSpin4Square class="mx-auto text-accent" />
              <p class="mt-3 text-sm text-muted-foreground">{messageTranslate("common.loading")}</p>
            </div>
          </div>
        </Show>
      }
    >
      {props.children}
    </Show>
  )
}
