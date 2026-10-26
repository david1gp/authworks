import { Show } from "solid-js"
import { authenticatedImageFallbackStateCreate } from "../authenticated/authenticatedImageFallbackStateCreate.js"
import { authenticatedInitialsGet } from "../authenticated/authenticatedInitialsGet.js"

/**
 * Organization mark: the branding icon when one is configured and loads, otherwise the label
 * initials on the caller-provided tone. Broken images fall back to initials instead of a
 * broken-image glyph.
 */
export function ProductionOrganizationTile(props: {
  readonly imageUrl: string | undefined
  readonly label: string
  readonly tileClass: string
}) {
  const fallback = authenticatedImageFallbackStateCreate(() => props.imageUrl ?? "")
  return (
    <span aria-hidden="true" class={props.tileClass}>
      <Show fallback={authenticatedInitialsGet(props.label)} when={!fallback.failed()}>
        <img alt="" class="size-full object-cover" onError={fallback.onError} src={props.imageUrl} />
      </Show>
    </span>
  )
}
