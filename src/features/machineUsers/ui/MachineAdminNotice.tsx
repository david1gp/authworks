import { Show } from "solid-js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

const noticeKeys = {
  "api-key-created": "admin.machine.credentials.apiKeyCreated",
  "client-secret-rotated": "admin.machine.secret.rotated",
  "credential-revoked": "admin.machine.credentials.revoked",
  "machine-user-created": "admin.machine.users.created",
  "machine-user-lifecycle": "admin.machine.users.lifecycleChanged",
  "personal-access-token-created": "admin.machine.credentials.tokenCreated",
} as const satisfies Readonly<Record<string, MessageKey>>

/** Announces the outcome of the most recent machine-user administration mutation. */
export function MachineAdminNotice(props: { readonly notice?: string }) {
  const key = () => noticeKeys[props.notice as keyof typeof noticeKeys]
  return <Show when={key()}>{(messageKey) => <AuthenticatedNotice message={messageTranslate(messageKey())} />}</Show>
}
