import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiInboxOutline } from "@adaptive-ds/mdi/mdiInboxOutline.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderSpin4Square } from "#ui/static/loaders/LoaderSpin4Square.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
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
        "mx-auto flex flex-col items-center justify-center text-center",
        props.compact
          ? "min-h-40 max-w-md px-4 py-8"
          : "min-h-72 max-w-xl rounded-panel border border-line bg-surface px-6 py-12",
      )}
      data-content-state={props.state}
    >
      {props.state === "loading" ? (
        <LoaderSpin4Square class={props.compact ? "mb-3 text-accent" : "mb-5 text-accent"} />
      ) : (
        <span
          class={classMerge(
            "grid place-items-center rounded-panel bg-muted text-muted-foreground",
            props.compact ? "mb-3 size-9" : "mb-5 size-12",
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
      <h2 class={props.compact ? "text-sm font-semibold" : "text-lg font-semibold tracking-tight"}>
        {props.title ??
          (props.state === "loading"
            ? messageTranslate("common.loading")
            : props.state === "error"
              ? messageTranslate("common.error")
              : props.state === "inaccessible"
                ? messageTranslate("shell.state.pageUnavailable")
                : messageTranslate("shell.state.nothingHere"))}
      </h2>
      <p class={classMerge("mt-1.5 max-w-md text-muted-foreground", props.compact ? "text-xs" : "text-sm")}>
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
        <Button class="mt-4" onClick={props.onRetry} size="sm" variant="outline">
          {messageTranslate("common.retry")}
        </Button>
      ) : null}
    </section>
  )
}
