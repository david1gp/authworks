import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedAvatarColorGet } from "./authenticatedAvatarColorGet.js"
import type { AuthenticatedAvatarSize } from "./authenticatedAvatarSize.js"
import { authenticatedAvatarSizeClassGet } from "./authenticatedAvatarSizeClassGet.js"
import { authenticatedImageFallbackStateCreate } from "./authenticatedImageFallbackStateCreate.js"
import { authenticatedInitialsGet } from "./authenticatedInitialsGet.js"

export function authenticatedAvatarStateCreate(options: {
  readonly class?: () => string | undefined
  readonly name: () => string
  readonly size: () => AuthenticatedAvatarSize
  readonly src: () => string
}) {
  const fallback = authenticatedImageFallbackStateCreate(options.src)
  return {
    imageFailed: fallback.onError,
    imageVisible: () => !fallback.failed(),
    class: () =>
      classMerge(
        "grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold ring-1 ring-line-subtle ring-inset",
        authenticatedAvatarSizeClassGet(options.size()),
        authenticatedAvatarColorGet(options.name()),
        options.class?.(),
      ),
    initials: () => authenticatedInitialsGet(options.name()),
    name: options.name,
  }
}
