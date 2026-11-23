import { omit } from "solid-js"
import { classesTextLink } from "#ui/classes/classesTextLink.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { type ComponentProps } from "@solidjs/web"

export interface BlueBulletPointProps extends ComponentProps<"span"> {}

/** A single blue link-colored bullet dot marker. */
export function BlueBulletPoint(p: BlueBulletPointProps) {
  const rest = omit(p, "class")
  return (
    <span
      class={classMerge(
        "text-sm select-none", // font
        "mr-1 mt-1.5", // spacing
        classesTextLink,
        p.class,
      )}
      style={{ "font-size": "0.5rem" }}
      aria-hidden="true"
      {...rest}
    >
      ●
    </span>
  )
}
