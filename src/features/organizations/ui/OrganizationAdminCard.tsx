import { Show } from "solid-js"
import { AuthenticatedCopyField } from "../../../ui/authenticated/AuthenticatedCopyField.js"
import { AuthenticatedEntityCard } from "../../../ui/authenticated/AuthenticatedEntityCard.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Organization } from "../public/organizationSchema.js"
import { organizationAdminStatusTone } from "./organizationAdminStatusTone.js"

export function OrganizationAdminCard(props: { readonly organization: Organization; readonly href: string }) {
  return (
    <AuthenticatedEntityCard
      entityId={props.organization.id}
      href={props.href}
      label={props.organization.name}
      title={props.organization.name}
      status={
        <span class="flex flex-col items-end gap-0.5">
          <AuthenticatedStatus
            label={messageTranslate(`admin.organizations.statusValue.${props.organization.status}`)}
            tone={organizationAdminStatusTone(props.organization.status)}
          />
          <span class="text-xs text-muted-foreground whitespace-nowrap">
            {messageTranslate("admin.organizations.detail.created")}:{" "}
            <AuthenticatedRelativeTime value={props.organization.createdAt} />
          </span>
        </span>
      }
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <Show when={props.organization.slug}>
          <AuthenticatedCopyField
            identifier
            label={messageTranslate("admin.teams.slug")}
            copyLabel={messageTranslate("admin.teams.slug")}
            value={props.organization.slug}
          />
        </Show>
        <AuthenticatedCopyField
          identifier
          label={messageTranslate("admin.redesign.id")}
          copyLabel={messageTranslate("admin.redesign.id")}
          value={props.organization.id}
        />
      </div>
    </AuthenticatedEntityCard>
  )
}
