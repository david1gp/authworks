import { createSignalObject } from "#ui/utils/createSignalObject.js"

/**
 * Tracks whether a remote image failed to load so a surface can fall back to a neutral placeholder
 * instead of a broken image. Hosted avatar URLs are owned by the deployment and may be unreachable,
 * and demo fixtures reference an example host that never resolves.
 */
export function authenticatedImageFallbackStateCreate(url: () => string) {
  const failedUrl = createSignalObject<string | undefined>(undefined)
  return {
    failed: () => url().length === 0 || failedUrl.get() === url(),
    onError: () => failedUrl.set(url()),
  }
}
