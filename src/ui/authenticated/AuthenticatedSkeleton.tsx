import { classMerge } from "#ui/utils/classMerge.js"

/** Shimmer placeholder block for loading content; size it with layout classes from the caller. */
export function AuthenticatedSkeleton(props: { readonly class?: string; readonly index?: number }) {
  return (
    <span
      aria-hidden="true"
      class={classMerge("block animate-pulse rounded-control bg-muted", props.class)}
      style={props.index === undefined ? undefined : { "animation-delay": `${props.index * 90}ms` }}
    />
  )
}
