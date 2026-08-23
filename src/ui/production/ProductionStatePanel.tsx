import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiInboxOutline } from "@adaptive-ds/mdi/mdiInboxOutline.js"
import { mdiLockOutline } from "@adaptive-ds/mdi/mdiLockOutline.js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { LoaderSpin4Square } from "#ui/static/loaders/LoaderSpin4Square.jsx"
import { messageTranslate } from "../i18n/model/messageTranslate.js"

export function ProductionStatePanel(props: {
  readonly detail?: string
  readonly onRetry?: () => void
  readonly state: "empty" | "error" | "inaccessible" | "loading"
  readonly title?: string
}) {
  return (
    <section
      aria-live={props.state === "loading" ? "polite" : undefined}
      class="mx-auto flex min-h-72 max-w-xl flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-12 text-center shadow-sm"
      data-content-state={props.state}
    >
      {props.state === "loading" ? (
        <LoaderSpin4Square class="mb-5 text-accent" />
      ) : (
        <span class="mb-5 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
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
      <h2 class="text-xl font-semibold">
        {props.title ??
          (props.state === "loading"
            ? messageTranslate("common.loading")
            : props.state === "error"
              ? messageTranslate("common.error")
              : props.state === "inaccessible"
                ? messageTranslate("shell.state.pageUnavailable")
                : messageTranslate("shell.state.nothingHere"))}
      </h2>
      <p class="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
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
        <Button class="mt-6" onClick={props.onRetry}>
          {messageTranslate("common.retry")}
        </Button>
      ) : null}
    </section>
  )
}
