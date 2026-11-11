import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiContentCopy } from "@adaptive-ds/mdi/mdiContentCopy.js"
import { Show } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { AuthenticatedButton } from "./AuthenticatedButton.js"
import { authenticatedCopyButtonStateCreate } from "./authenticatedCopyButtonStateCreate.js"

export function AuthenticatedCopyButton(props: {
  readonly class?: string
  readonly label: string
  readonly value: string
}) {
  const state = authenticatedCopyButtonStateCreate({ value: () => props.value })
  return (
    <Show when={props.value}>
      <AuthenticatedButton
        class={classMerge(
          "size-5 p-0 text-muted-foreground opacity-60 transition-[color,background-color,opacity] hover:opacity-100 focus-visible:opacity-100",
          (state.copied() || state.failed()) && "opacity-100",
          props.class,
        )}
        variant="ghost"
        size="sm"
        icon={state.copied() ? mdiCheck : mdiContentCopy}
        onClick={state.copy}
        aria-label={
          state.copied()
            ? messageTranslate("ui.authenticated.copied")
            : state.failed()
              ? messageTranslate("ui.authenticated.copyFailed", { field: props.label })
              : messageTranslate("ui.authenticated.copyField", { field: props.label })
        }
        title={
          state.copied()
            ? messageTranslate("ui.authenticated.copied")
            : state.failed()
              ? messageTranslate("ui.authenticated.copyFailed", { field: props.label })
              : messageTranslate("ui.authenticated.copyField", { field: props.label })
        }
      />
      <span aria-live="polite" class="sr-only">
        {state.copied()
          ? messageTranslate("ui.authenticated.copied")
          : state.failed()
            ? messageTranslate("ui.authenticated.copyFailed", { field: props.label })
            : ""}
      </span>
    </Show>
  )
}
