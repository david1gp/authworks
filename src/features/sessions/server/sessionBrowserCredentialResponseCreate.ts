import type { Result } from "#result"
import { sessionBrowserCookieSerialize } from "../domain/sessionBrowserCookieSerialize.js"

type SessionBrowserCredentialResponseContext = {
  readonly header: (name: string, value: string) => void
}

type SessionBrowserCredentialResponseRedact<T> = T extends { readonly session?: unknown } ? Omit<T, "session"> : T

export function sessionBrowserCredentialResponseCreate<T>(
  context: SessionBrowserCredentialResponseContext,
  result: Result<T>,
): Result<SessionBrowserCredentialResponseRedact<T>> {
  if (!result.success) return result
  const credential = sessionBrowserCredentialGet(result.data)
  if (credential === undefined) return { data: result.data as SessionBrowserCredentialResponseRedact<T>, success: true }
  const serialized = sessionBrowserCookieSerialize("session", credential.token)
  if (!serialized.success) return serialized
  context.header("set-cookie", serialized.data)
  const { session: _session, ...data } = result.data as T & { readonly session: { readonly token: string } }
  return { data: data as SessionBrowserCredentialResponseRedact<T>, success: true }
}

function sessionBrowserCredentialGet(value: unknown): { readonly token: string } | undefined {
  if (typeof value !== "object" || value === null || !("session" in value)) return undefined
  const session = value.session
  if (typeof session !== "object" || session === null || !("token" in session)) return undefined
  return typeof session.token === "string" ? { token: session.token } : undefined
}
