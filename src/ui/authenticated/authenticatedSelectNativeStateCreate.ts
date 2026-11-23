import { omit } from "solid-js"
import type { AuthenticatedSelectProps } from "./authenticatedSelectProps.js"
import { type JSX } from "@solidjs/web"

export function authenticatedSelectNativeStateCreate(props: AuthenticatedSelectProps) {
  const local = props
  const rest = omit(props, "valueSignal", "getOptions", "valueText", "class")
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
