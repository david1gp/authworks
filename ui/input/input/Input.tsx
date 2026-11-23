import type { Component } from "solid-js"
import { omit } from "solid-js"
import { classesInput } from "#ui/input/input/classesInput.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { type ComponentProps } from "@solidjs/web"

/** Styled native text input element. */
export const Input: Component<ComponentProps<"input">> = (p) => {
  const rest = omit(p, "class")
  return <input class={classMerge(classesInput, p.class)} dir="auto" {...rest} />
}
