import { Show } from "solid-js"
import type { AuthenticatedAvatarSize } from "./authenticatedAvatarSize.js"
import { authenticatedAvatarStateCreate } from "./authenticatedAvatarStateCreate.js"

/**
 * Circular user mark: photo when it loads, otherwise initials on a deterministic tone derived
 * from the name. Broken images fall back to initials instead of a broken-image glyph.
 */
export function AuthenticatedAvatar(props: {
  readonly class?: string
  readonly name: string
  readonly size?: AuthenticatedAvatarSize
  readonly src?: string
}) {
  const state = authenticatedAvatarStateCreate({
    class: () => props.class,
    name: () => props.name,
    size: () => props.size ?? "md",
    src: () => props.src ?? "",
  })
  return (
    <span aria-label={state.name()} class={state.class()} role="img">
      <Show when={state.imageVisible()} fallback={<span aria-hidden="true">{state.initials()}</span>}>
        <img alt="" class="size-full object-cover" onError={state.imageFailed} src={props.src} />
      </Show>
    </span>
  )
}
