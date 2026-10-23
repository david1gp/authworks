import type { AuthenticatedAvatarSize } from "./authenticatedAvatarSize.js"

const sizeClasses: Record<AuthenticatedAvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
}

/** Fixed square and type scale for one avatar size; the shell adds shape, ring, and tone. */
export function authenticatedAvatarSizeClassGet(size: AuthenticatedAvatarSize): string {
  return sizeClasses[size]
}
