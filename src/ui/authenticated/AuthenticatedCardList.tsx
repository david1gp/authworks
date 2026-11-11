import type { JSX } from "solid-js"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedCardClasses } from "./authenticatedCardClasses.js"
export function AuthenticatedCardList(props: {
  readonly children?: JSX.Element
  readonly class?: string
  readonly label: string
}) {
  return (
    <ul aria-label={props.label} class={classMerge(authenticatedCardClasses.list, props.class)}>
      {props.children}
    </ul>
  )
}
