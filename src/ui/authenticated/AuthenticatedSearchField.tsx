import { mdiClose } from "@adaptive-ds/mdi/mdiClose.js"
import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"
import { authenticatedControlClasses } from "./authenticatedControlClasses.js"
import { authenticatedSearchFieldStateCreate } from "./authenticatedSearchFieldStateCreate.js"

/**
 * Search input with a leading icon and a clear button. Reports keystrokes through `onInput`;
 * pair it with `authenticatedUrlSearchParamWrite` to persist `?q=` in the URL.
 */
export function AuthenticatedSearchField(props: {
  readonly class?: string
  readonly label?: string
  readonly onInput: (value: string) => void
  readonly placeholder?: string
  readonly value: string
}) {
  const state = authenticatedSearchFieldStateCreate({
    onInput: (value) => props.onInput(value),
    value: () => props.value,
  })
  return (
    <span class={classMerge("relative block min-w-0", props.class)} data-search-field="">
      <Icon
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        path={mdiMagnify}
      />
      <input
        aria-label={props.label ?? messageTranslate("ui.authenticated.search")}
        class={classMerge(authenticatedControlClasses.input, "pr-9 pl-9")}
        onInput={state.input}
        placeholder={props.placeholder ?? messageTranslate("ui.authenticated.search")}
        type="search"
        value={state.value()}
      />
      <Show when={state.clearVisible()}>
        <button
          aria-label={messageTranslate("ui.authenticated.clearSearch")}
          class={classMerge(
            authenticatedButtonClassGet("ghost", "sm", true),
            "absolute top-1/2 right-1 size-7 -translate-y-1/2",
          )}
          onClick={state.clear}
          type="button"
        >
          <Icon aria-hidden="true" class="size-4" path={mdiClose} />
        </button>
      </Show>
    </span>
  )
}
