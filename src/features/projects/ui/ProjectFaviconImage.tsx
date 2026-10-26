import { Show } from "solid-js"
import { projectFaviconImageStateCreate } from "./projectFaviconImageStateCreate.js"

/** Project mark: callback-origin favicon while it loads, otherwise the neutral project initial. */
export function ProjectFaviconImage(props: {
  readonly faviconHref: (projectId: string) => string | undefined
  readonly name: string
  readonly projectId: string
}) {
  const state = projectFaviconImageStateCreate({
    href: () => props.faviconHref(props.projectId),
    name: () => props.name,
  })
  return (
    <span
      aria-label={props.name}
      class="grid size-6 shrink-0 place-items-center overflow-hidden rounded bg-muted text-xs font-medium text-muted-foreground"
      role="img"
    >
      <Show fallback={<span aria-hidden="true">{state.initial()}</span>} when={state.src()}>
        {(src) => <img alt="" class="size-full object-contain" onError={state.imageError} src={src()} />}
      </Show>
    </span>
  )
}
