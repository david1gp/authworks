const interactionHandlePattern = /^[A-Za-z0-9_-]{43,128}$/

/** Accepts only opaque interaction handles that match the server-issued handle shape. */
export function loginInteractionHandleSelect(handle: string | null | undefined): string | undefined {
  if (handle === null || handle === undefined) return undefined
  return interactionHandlePattern.test(handle) ? handle : undefined
}
