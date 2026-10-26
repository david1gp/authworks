import { authenticatedImageFallbackStateCreate } from "../../../ui/authenticated/authenticatedImageFallbackStateCreate.js"
import { authenticatedInitialsGet } from "../../../ui/authenticated/authenticatedInitialsGet.js"

/** Favicon view state: proxied icon while it loads, neutral initial on missing or failed icons. */
export function projectFaviconImageStateCreate(options: {
  readonly href: () => string | undefined
  readonly name: () => string
}) {
  const fallback = authenticatedImageFallbackStateCreate(() => options.href() ?? "")
  return {
    imageError: fallback.onError,
    initial: () => authenticatedInitialsGet(options.name()),
    src: () => {
      const href = options.href()
      if (href === undefined || fallback.failed()) return undefined
      return href
    },
  }
}
