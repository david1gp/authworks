import { omit } from "solid-js"
import { classesCardWrapperP4 } from "#ui/static/card/classesCardWrapper.js"
import { classMerge } from "#ui/utils/classMerge.js"
import { type ComponentProps } from "@solidjs/web"

export interface CardWrapperProps extends ComponentProps<"article"> {
  id?: string
}

/** Styled card container wrapping article content. */
export function CardWrapper(p: CardWrapperProps) {
  const rest = omit(p, "id", "class")
  return <article id={p.id} class={classMerge(classesCardWrapperP4, p.class)} {...rest} />
}
