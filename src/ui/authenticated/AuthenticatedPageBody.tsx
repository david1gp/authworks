import type { JSX } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"

/**
 * Dense vertical stack for the body of an authenticated page. It is deliberately not a landmark:
 * the page is already named by the shell `main` and its single `h1`, so wrapping the body in a
 * second labelled region only produces a duplicate landmark name for assistive technology.
 */
export function AuthenticatedPageBody(props: { readonly children: JSX.Element; readonly class?: string }) {
  return <div class={classMerge("grid min-w-0 gap-3 [&>*]:min-w-0", props.class)}>{props.children}</div>
}
