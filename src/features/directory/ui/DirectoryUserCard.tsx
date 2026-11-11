import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiPhoneOutline } from "@adaptive-ds/mdi/mdiPhoneOutline.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { AuthenticatedAvatar } from "../../../ui/authenticated/AuthenticatedAvatar.js"
import { AuthenticatedCopyButton } from "../../../ui/authenticated/AuthenticatedCopyButton.js"
import { AuthenticatedCopyField } from "../../../ui/authenticated/AuthenticatedCopyField.js"
import { AuthenticatedEntityCard } from "../../../ui/authenticated/AuthenticatedEntityCard.js"
import { AuthenticatedRelativeTime } from "../../../ui/authenticated/AuthenticatedRelativeTime.js"
import { authenticatedCardClasses } from "../../../ui/authenticated/authenticatedCardClasses.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import { directoryUserCardRoleTextGet } from "./directoryUserCardRoleTextGet.js"

export function DirectoryUserCard(props: {
  readonly entry: DirectoryEntry
  readonly href: string
  readonly organizationId: string
  readonly scope: "all" | "organization"
}) {
  return (
    <AuthenticatedEntityCard
      class={authenticatedCardClasses.cardInteractive}
      entityId={props.entry.user.id}
      label={messageTranslate("admin.users.directoryOpenProfile", {
        name: props.entry.user.displayName ?? props.entry.user.userName,
      })}
      leading={
        <AuthenticatedAvatar
          class="size-6"
          name={props.entry.user.displayName ?? props.entry.user.userName}
          size="sm"
          src={props.entry.user.pictureUrl}
        />
      }
      title={
        <span class="flex min-w-0 items-center gap-1">
          <A
            class="min-w-0 truncate after:absolute after:inset-0"
            href={props.href}
            aria-label={messageTranslate("admin.users.directoryOpenProfile", {
              name: props.entry.user.displayName ?? props.entry.user.userName,
            })}
          >
            {props.entry.user.displayName ?? props.entry.user.userName}
          </A>
          <span class="relative z-10">
            <AuthenticatedCopyButton
              label={messageTranslate("admin.users.displayName")}
              value={props.entry.user.displayName ?? props.entry.user.userName}
            />
          </span>
        </span>
      }
    >
      <div class="flex min-w-0 flex-col gap-y-2">
        <div class="flex min-w-0 flex-col items-start gap-y-0.5">
          <AuthenticatedCopyField
            icon={mdiAccountOutline}
            label={messageTranslate("admin.redesign.atSign")}
            copyLabel={messageTranslate("admin.userProfile.username")}
            value={props.entry.user.userName}
          />
          <AuthenticatedCopyField
            icon={mdiEmailOutline}
            copyLabel={messageTranslate("admin.users.email")}
            value={props.entry.user.email}
            adornment={
              <Show when={!props.entry.user.emailVerified}>
                <span
                  aria-label={messageTranslate("admin.users.unverifiedEmail")}
                  class="size-2 rounded-full bg-warning"
                  role="img"
                  title={messageTranslate("admin.users.unverifiedEmail")}
                />
              </Show>
            }
          />
          <Show when={props.entry.user.phoneNumber}>
            <AuthenticatedCopyField
              icon={mdiPhoneOutline}
              copyLabel={messageTranslate("admin.userProfile.phone")}
              value={props.entry.user.phoneNumber}
            />
          </Show>
        </div>
        <div class="flex min-w-0 flex-col gap-y-0.5">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="min-w-0 truncate text-xs text-muted-foreground" title={props.entry.team?.name ?? undefined}>
              {props.entry.team?.name ?? messageTranslate("admin.users.directoryTeamUnassigned")}
            </span>
            <Show when={directoryUserCardRoleTextGet(props.entry, props.organizationId, props.scope)}>
              {(roleText) => (
                <>
                  <span aria-hidden="true" class="shrink-0 text-xs text-muted-foreground/50">
                    ·
                  </span>
                  <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={roleText()}>
                    {roleText()}
                  </span>
                </>
              )}
            </Show>
          </div>
          <span class="flex flex-col text-xs text-muted-foreground">
            <span>
              {messageTranslate("admin.users.directoryLastSignIn")}:{" "}
              <AuthenticatedRelativeTime
                fallback={<span class="text-muted-foreground">{messageTranslate("admin.users.directoryNever")}</span>}
                value={props.entry.user.lastSignInAt}
              />
            </span>
            <span>
              {messageTranslate("admin.users.directoryCreated")}:{" "}
              <AuthenticatedRelativeTime value={props.entry.user.createdAt} />
            </span>
          </span>
        </div>
      </div>
    </AuthenticatedEntityCard>
  )
}
