import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

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
  return (
    <Show when={key()}>
      {(messageKey) => (
        <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
          {messageTranslate(messageKey())}
        </p>
      )}
    </Show>
  )
}
