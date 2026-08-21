import { Show } from "solid-js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

const noticeKeys = {
  "branding-saved": "admin.organizations.branding.saved",
  "domain-claimed": "admin.organizations.domains.claimed",
  "domain-removed": "admin.organizations.domains.removed",
  "domain-verified": "admin.organizations.domains.verifyDone",
  "invitation-created": "admin.organizations.invitations.sent",
  "invitation-revoked": "admin.organizations.invitations.revoked",
  "membership-added": "admin.organizations.memberships.added",
  "membership-removed": "admin.organizations.memberships.removed",
  "membership-updated": "admin.organizations.memberships.updated",
  "organization-lifecycle": "admin.organizations.lifecycle.changed",
  "organization-renamed": "admin.organizations.renamed",
  "policy-saved": "admin.organizations.policy.saved",
  "provider-created": "admin.organizations.providers.created",
  "provider-disabled": "admin.organizations.providers.disabled",
  "provider-secret-rotated": "admin.organizations.providers.secretRotated",
  "provider-updated": "admin.organizations.providers.updated",
} as const satisfies Readonly<Record<string, MessageKey>>

/** Announces the outcome of the most recent organization administration mutation. */
export function OrganizationAdminNotice(props: { readonly notice?: string; readonly values?: Record<string, string> }) {
  const key = () => noticeKeys[props.notice as keyof typeof noticeKeys]
  return (
    <Show when={key()}>
      {(messageKey) => (
        <p class="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
          {messageTranslate(messageKey(), props.values)}
        </p>
      )}
    </Show>
  )
}
