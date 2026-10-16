import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiInboxOutline } from "@adaptive-ds/mdi/mdiInboxOutline.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { mdiRefresh } from "@adaptive-ds/mdi/mdiRefresh.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderSpin4Square } from "#ui/static/loaders/LoaderSpin4Square.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { AuthenticatedButton } from "../authenticated/AuthenticatedButton.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"

export function ProductionStatePanel(props: {
  /** Removes the panel chrome and shrinks the block so it can sit inside an authenticated section. */
  readonly compact?: boolean
  readonly detail?: string
  readonly onRetry?: () => void
  readonly state: "empty" | "error" | "inaccessible" | "loading"
  readonly title?: string
}) {
  return (
    <section
      aria-live={props.state === "loading" ? "polite" : undefined}
      class={classMerge(
        "mx-auto flex flex-col items-center justify-center text-center in-[[data-shell=focus]]:min-h-0 in-[[data-shell=focus]]:rounded-none in-[[data-shell=focus]]:border-0 in-[[data-shell=focus]]:bg-transparent in-[[data-shell=focus]]:px-0 in-[[data-shell=focus]]:py-2 in-[[data-shell=focus]]:shadow-none",
        props.compact
          ? "min-h-40 max-w-md px-4 py-8"
          : "min-h-72 max-w-xl rounded-panel border border-line bg-surface px-6 py-12 shadow-panel",
      )}
      data-content-state={props.state}
    >
      {props.state === "loading" ? (
        <LoaderSpin4Square class={props.compact ? "mb-3 text-accent" : "mb-5 text-accent"} />
      ) : (
        <span
          class={classMerge(
            "grid size-11 place-items-center rounded-full",
            props.state === "error" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent",
            props.compact ? "mb-3" : "mb-5",
          )}
        >
          <Icon
            path={
              props.state === "error"
                ? mdiAlertCircleOutline
                : props.state === "inaccessible"
                  ? mdiLockOutline
                  : mdiInboxOutline
            }
          />
        </span>
      )}
      <h2 class="text-base font-semibold">
        {props.title ??
          (props.state === "loading"
            ? messageTranslate("common.loading")
            : props.state === "error"
              ? messageTranslate("common.error")
              : props.state === "inaccessible"
                ? messageTranslate("shell.state.pageUnavailable")
                : messageTranslate("shell.state.nothingHere"))}
      </h2>
      <p class="mt-1.5 max-w-md text-sm text-muted-foreground">
        {props.detail ??
          (props.state === "loading"
            ? messageTranslate("shell.state.loadingDetail")
            : props.state === "error"
              ? messageTranslate("shell.state.errorDetail")
              : props.state === "inaccessible"
                ? messageTranslate("shell.state.inaccessibleDetail")
                : messageTranslate("shell.state.readyDetail"))}
      </p>
      {props.state === "error" && props.onRetry ? (
        <AuthenticatedButton class="mt-4" icon={mdiRefresh} onClick={props.onRetry} variant="outline">
          {messageTranslate("common.retry")}
        </AuthenticatedButton>
      ) : null}
    </section>
  )
}
