import { createEffect } from "solid-js"

export type SetPageTitleProps = {
  title: string
}

/** Sets the document title; renders nothing. */
export function SetPageTitle(p: SetPageTitleProps) {
  createEffect(
    () => p.title,
    (title) => {
      if (title) document.title = title
    },
  )
  return null
}
