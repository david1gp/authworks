import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedImageFallbackStateCreate } from "../../../ui/authenticated/authenticatedImageFallbackStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"

/**
 * Compact identity strip that keeps the signed-in person visible above their settings. The avatar is
 * decorative because the name beside it already carries the same information.
 */
export function AccountProfileIdentityStrip(props: {
  readonly displayName: string
  readonly email: string
  readonly emailVerified: boolean
  readonly pictureUrl: string
  readonly userName: string
}) {
  const picture = authenticatedImageFallbackStateCreate(() => props.pictureUrl)
  return (
    <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-line bg-surface px-3 py-2.5">
      <div class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-muted text-muted-foreground">
        <Show when={!picture.failed()} fallback={<Icon class="size-5" path={mdiAccountCircleOutline} />}>
          <img
            aria-hidden="true"
            class="size-full object-cover"
            onError={picture.onError}
            role="presentation"
            src={props.pictureUrl}
          />
        </Show>
      </div>
      <div class="min-w-0 flex-1">
        <p class="min-w-0 truncate text-sm font-semibold tracking-tight">
          {props.displayName || props.userName || props.email}
        </p>
        <p class="min-w-0 truncate font-mono text-xs text-muted-foreground">{props.userName || props.email}</p>
      </div>
      <AuthenticatedStatus
        label={
          props.emailVerified
            ? messageTranslate("account.profile.verified")
            : messageTranslate("account.profile.verificationPending")
        }
        tone={props.emailVerified ? "success" : "warning"}
      />
    </div>
  )
}
