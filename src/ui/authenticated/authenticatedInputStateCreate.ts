import { omit } from "solid-js"
import { type ComponentProps } from "@solidjs/web"

export function authenticatedInputStateCreate(props: ComponentProps<"input">) {
  const local = props
  const rest = omit(props, "class")
  return { local, rest }
}
