/**
 * Protocol documents are served by the realm itself. A stateless demo publishes fixture
 * endpoints that resolve nowhere, so an "open endpoint" control is only offered when the
 * endpoint belongs to the current origin. Otherwise the endpoint stays visible as text.
 */
export function oidcAdminDocumentOpenHrefSelect(endpoint: string, origin: string | undefined): string | undefined {
  if (origin === undefined || origin.length === 0) return undefined
  try {
    return new URL(endpoint).origin === new URL(origin).origin ? endpoint : undefined
  } catch {
    return undefined
  }
}
