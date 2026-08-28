import { Show } from "solid-js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

const noticeKeys = {
  "client-created": "admin.oidc.clients.created",
  "client-lifecycle": "admin.oidc.clients.lifecycleChanged",
  "client-saved": "admin.oidc.clients.saved",
  "consent-revoked": "admin.oidc.consents.revoked",
  "secret-revoked": "admin.oidc.secret.revoked",
  "secret-rotated": "admin.oidc.secret.rotated",
  "signing-key-created": "admin.oidc.keys.created",
  "signing-key-retired": "admin.oidc.keys.retired",
  "signing-key-rotated": "admin.oidc.keys.rotated",
} as const satisfies Readonly<Record<string, MessageKey>>

/** Announces the outcome of the most recent OIDC administration mutation. */
export function OidcAdminNotice(props: { readonly notice?: string }) {
  const key = () => noticeKeys[props.notice as keyof typeof noticeKeys]
  return <Show when={key()}>{(messageKey) => <AuthenticatedNotice message={messageTranslate(messageKey())} />}</Show>
}
