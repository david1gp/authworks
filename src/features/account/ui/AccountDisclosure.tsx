import type { JSX } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Collapsed-by-default account disclosure built on native `details`/`summary`, so expanding and
 * collapsing keeps browser keyboard semantics (Enter/Space, `aria-expanded`) without extra script.
 */
export function AccountDisclosure(props: {
  readonly children: JSX.Element
  readonly class?: string
  readonly summary: string
}) {
  return (
    <details class={classMerge("group min-w-0 rounded-control border border-line-subtle", props.class)}>
      <summary class="cursor-pointer rounded-control px-2 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
        {props.summary}
      </summary>
      <div class="min-w-0 border-t border-line-subtle px-2 py-1.5">{props.children}</div>
    </details>
  )
}
