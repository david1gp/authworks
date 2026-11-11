import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedCopyField } from "../../../ui/authenticated/AuthenticatedCopyField.js"
import { AuthenticatedEntityCard } from "../../../ui/authenticated/AuthenticatedEntityCard.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import { sessionDeviceLabelGet } from "../../sessions/ui/sessionDeviceLabelGet.js"

export function AdminSessionCard(props: {
  readonly disabled: boolean
  readonly onRevoke: () => void
  readonly session: Session
}) {
  return (
    <AuthenticatedEntityCard
      entityId={props.session.id}
      label={sessionDeviceLabelGet(props.session.device)}
      title={sessionDeviceLabelGet(props.session.device)}
      actions={
        <AuthenticatedButton
          aria-label={messageTranslate("common.revoke")}
          title={messageTranslate("common.revoke")}
          disabled={props.disabled}
          icon={mdiCancel}
          onClick={props.onRevoke}
          variant="outline"
        />
      }
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span
          class="[overflow-wrap:anywhere] text-sm"
          title={[props.session.subjectDisplayName, props.session.subjectEmail, props.session.subjectId]
            .filter(Boolean)
            .join(" · ")}
        >
          {props.session.subjectDisplayName || props.session.subjectEmail || props.session.subjectId}
          <Show when={props.session.subjectDisplayName && props.session.subjectEmail}>
            <span class="ml-2 text-xs text-muted-foreground">{props.session.subjectEmail}</span>
          </Show>
        </span>
        <AuthenticatedCopyField
          class="shrink-0"
          identifier
          label={messageTranslate("admin.sessions.id")}
          copyLabel={messageTranslate("admin.sessions.id")}
          value={props.session.id}
        />
        <span
          class="[overflow-wrap:anywhere] text-xs"
          title={[props.session.device.ipAddress, props.session.device.region, props.session.device.countryCode]
            .filter(Boolean)
            .join(", ")}
        >
          <span class="text-muted-foreground">{messageTranslate("admin.redesign.ip")}: </span>
          <span class="font-mono">{props.session.device.ipAddress || "—"}</span>
        </span>
        <span
          class="[overflow-wrap:anywhere] text-xs"
          title={[props.session.device.ipAddress, props.session.device.region, props.session.device.countryCode]
            .filter(Boolean)
            .join(", ")}
        >
          <span class="text-muted-foreground">{messageTranslate("admin.users.sessions.location")}: </span>
          {[props.session.device.region, props.session.device.countryCode].filter(Boolean).join(", ") || "—"}
        </span>
        <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {messageTranslate("login.chooser.lastUsed")}: <AuthenticatedRelativeTime value={props.session.lastUsedAt} />
          </span>
          <span>
            {messageTranslate("admin.users.sessions.expires")}:{" "}
            <AuthenticatedRelativeTime value={props.session.expiresAt} />
          </span>
        </span>
      </div>
    </AuthenticatedEntityCard>
  )
}
