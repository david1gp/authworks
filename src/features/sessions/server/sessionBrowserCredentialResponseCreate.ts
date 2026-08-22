import type { Result } from "#result"
import { sessionBrowserCookieSerialize } from "../domain/sessionBrowserCookieSerialize.js"

type SessionBrowserCredentialResponseContext = {
  readonly header: (name: string, value: string) => void
}

type SessionBrowserCredentialResponseRedact<T> = T extends { readonly token: string }
  ? Omit<T, "token">
  : T extends { readonly session?: unknown }
    ? Omit<T, "session">
    : T

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
  if (sessionBrowserCredentialIsDirect(result.data)) {
    const { token: _token, ...data } = result.data as T & { readonly token: string }
    return { data: data as SessionBrowserCredentialResponseRedact<T>, success: true }
  }
  const { session: _session, ...data } = result.data as T & { readonly session: { readonly token: string } }
  return { data: data as SessionBrowserCredentialResponseRedact<T>, success: true }
}

function sessionBrowserCredentialGet(value: unknown): { readonly token: string } | undefined {
  if (sessionBrowserCredentialIsDirect(value)) return { token: value.token }
  if (typeof value !== "object" || value === null || !("session" in value)) return undefined
  const session = value.session
  if (typeof session !== "object" || session === null || !("token" in session)) return undefined
  return typeof session.token === "string" ? { token: session.token } : undefined
}

function sessionBrowserCredentialIsDirect(value: unknown): value is { readonly token: string } {
  return typeof value === "object" && value !== null && "token" in value && typeof value.token === "string"
}
