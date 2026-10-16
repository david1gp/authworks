import { type Accessor, type JSX, splitProps } from "solid-js"
import type { AuthenticatedSelectProps } from "./authenticatedSelectProps.js"

export function authenticatedSelectNativeStateCreate(props: Accessor<AuthenticatedSelectProps>) {
  const [local, rest] = splitProps(props(), ["valueSignal", "getOptions", "valueText", "class"])
  const change: JSX.EventHandler<HTMLSelectElement, Event> = (event) => {
    local.valueSignal.set(event.currentTarget.value)
  }
  return {
    local,
    rest,
    change,
    displayValue: (value: string) => local.valueText?.(value) || value,
  }
}
