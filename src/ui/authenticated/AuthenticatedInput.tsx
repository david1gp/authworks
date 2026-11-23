import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedControlClasses } from "./authenticatedControlClasses.js"
import { authenticatedInputStateCreate } from "./authenticatedInputStateCreate.js"
import { type ComponentProps } from "@solidjs/web"

export function AuthenticatedInput(props: ComponentProps<"input">) {
  const state = authenticatedInputStateCreate(props)
  return <input class={classMerge(authenticatedControlClasses.input, state.local.class)} dir="auto" {...state.rest} />
}
