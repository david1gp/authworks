import { type Component, omit } from "solid-js"
import { classesLabel } from "#ui/input/label/classesLabel.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { type ComponentProps } from "@solidjs/web"

/** Label-styled span for non-associated pseudo labels. */
export const LabelPseudo: Component<ComponentProps<"span">> = (p) => {
  const rest = omit(p, "class")
  return <span class={classMerge(classesLabel, p.class)} {...rest} />
}
