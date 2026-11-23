import type { Component } from "solid-js"
import { omit } from "solid-js"
import { classesLabel } from "#ui/input/label/classesLabel.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { type ComponentProps } from "@solidjs/web"

/** Styled native label element for form fields. */
export const Label: Component<ComponentProps<"label">> = (p) => {
  const rest = omit(p, "class")
  return <label class={classMerge(classesLabel, p.class)} {...rest} />
}
