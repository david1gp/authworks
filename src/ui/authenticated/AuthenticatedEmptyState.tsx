import { mdiInboxOutline } from "@adaptive-ds/mdi/mdiInboxOutline.js"
import type { JSX } from "solid-js"
import { children, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"

/** Centered panel for empty collections: icon, title, description, optional action slot. */
export function AuthenticatedEmptyState(props: {
  readonly actions?: JSX.Element
  readonly class?: string
  readonly description?: string
  readonly icon?: string
  readonly title: string
}) {
  const actions = children(() => props.actions)
  return (
    <div class={classMerge("grid justify-items-center gap-2 px-6 py-10 text-center", props.class)}>
      <span class="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" class="size-5.5" path={props.icon ?? mdiInboxOutline} />
      </span>
      <p class="text-sm font-semibold">{props.title}</p>
      <Show when={props.description}>
        {(description) => <p class="max-w-md text-[0.8125rem] text-muted-foreground">{description()}</p>}
      </Show>
      <Show when={actions.toArray().length > 0}>
        <div class="mt-1 flex flex-wrap items-center justify-center gap-2">{actions()}</div>
      </Show>
    </div>
  )
}
