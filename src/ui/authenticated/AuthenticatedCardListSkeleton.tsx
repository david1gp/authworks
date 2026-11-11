import { For } from "solid-js"
import { AuthenticatedSkeleton } from "./AuthenticatedSkeleton.js"
import { authenticatedCardClasses } from "./authenticatedCardClasses.js"
export function AuthenticatedCardListSkeleton(props: { readonly count?: number }) {
  return (
    <ul aria-hidden="true" class={authenticatedCardClasses.list}>
      <For each={Array.from({ length: props.count ?? 4 })}>
        {(_, index) => (
          <li class={authenticatedCardClasses.card}>
            <AuthenticatedSkeleton class="h-5 w-1/2" index={index()} />
            <AuthenticatedSkeleton class="h-4 w-full" />
            <AuthenticatedSkeleton class="h-4 w-2/3" />
          </li>
        )}
      </For>
    </ul>
  )
}
