import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { AuthenticatedButtonProps } from "./authenticatedButtonProps.js"
import { authenticatedButtonStateCreate } from "./authenticatedButtonStateCreate.js"

export function AuthenticatedButton(props: AuthenticatedButtonProps) {
  const state = authenticatedButtonStateCreate(() => props)
  return (
    <button
      {...state.rest}
      class={state.class()}
      type={state.local.type ?? "button"}
      disabled={state.local.disabled}
      aria-disabled={state.ariaDisabled()}
      onClick={state.click}
    >
      <Show when={state.iconVisible()}>
        <Icon path={state.icon()!} class={state.iconClass()} />
      </Show>
      {state.local.validationMessage || state.local.children}
      <Show when={state.iconRightVisible()}>
        <Icon path={state.local.iconRight!} class={state.iconClass()} />
      </Show>
    </button>
  )
}
