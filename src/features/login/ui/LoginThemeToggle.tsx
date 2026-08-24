import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"

type LoginThemeToggleProps = {
  readonly disabled: boolean
  readonly options: readonly {
    readonly icon: string
    readonly label: () => string
    readonly onSelect: () => void
    readonly pressed: () => boolean
  }[]
}

export function LoginThemeToggle(props: LoginThemeToggleProps) {
  return (
    <fieldset class="login-theme-toggle" disabled={props.disabled}>
      <legend class="sr-only">{props.options[2]?.label()}</legend>
      <For each={props.options}>
        {(option) => (
          <button
            aria-label={option.label()}
            aria-pressed={option.pressed()}
            class="login-theme-toggle-button"
            onClick={option.onSelect}
            title={option.label()}
            type="button"
          >
            <Icon class="size-4 fill-current dark:fill-current" path={option.icon} />
          </button>
        )}
      </For>
    </fieldset>
  )
}
