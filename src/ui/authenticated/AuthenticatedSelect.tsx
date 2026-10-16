import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedControlClasses } from "./authenticatedControlClasses.js"
import { authenticatedSelectNativeStateCreate } from "./authenticatedSelectNativeStateCreate.js"
import type { AuthenticatedSelectProps } from "./authenticatedSelectProps.js"

export function AuthenticatedSelect(props: AuthenticatedSelectProps) {
  const state = authenticatedSelectNativeStateCreate(() => props)
  return (
    <div class="relative w-full min-w-0">
      <select
        {...state.rest}
        class={classMerge(authenticatedControlClasses.select, "appearance-none pe-9", state.local.class)}
        value={state.local.valueSignal.get()}
        onChange={state.change}
      >
        <For each={state.local.getOptions()}>
          {(value) => (
            <option value={value} selected={state.local.valueSignal.get() === value}>
              {state.displayValue(value)}
            </option>
          )}
        </For>
      </select>
      <Icon
        path={mdiChevronDown}
        class="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
