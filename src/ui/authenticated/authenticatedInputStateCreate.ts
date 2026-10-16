import { type Accessor, type ComponentProps, splitProps } from "solid-js"

export function authenticatedInputStateCreate(props: Accessor<ComponentProps<"input">>) {
  const [local, rest] = splitProps(props(), ["class"])
  return { local, rest }
}
