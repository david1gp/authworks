import { Show } from "solid-js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountProfilePictureField } from "./AccountProfilePictureField.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"

export function AccountProfileIdentityStrip(props: {
  readonly configuredSecurityMethodCount?: number
  readonly displayName: string
  readonly email: string
  readonly emailVerified: boolean
  readonly onPictureRemove: () => void
  readonly onPictureUpload: (file: File) => void
  readonly pictureErrorMessage?: string
  readonly pictureStatus: AccountPictureViewStatus
  readonly pictureUrl: string
  readonly userName: string
}) {
  return (
    <section
      aria-label={messageTranslate("shell.nav.profile")}
      class="grid min-w-0 gap-4 overflow-hidden rounded-panel border border-line bg-surface p-4 sm:p-5"
    >
      <div class="grid min-w-0 items-center gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <AccountProfilePictureField
          errorMessage={props.pictureErrorMessage}
          onRemove={props.onPictureRemove}
          onUpload={props.onPictureUpload}
          status={props.pictureStatus}
          url={props.pictureUrl}
        />
        <div class="grid min-w-0 gap-4">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <div class="grid min-w-0 flex-1 gap-1">
              <p class="truncate text-2xl font-semibold tracking-tight">
                {props.displayName || props.userName || props.email}
              </p>
              <p class="text-sm text-muted-foreground">{messageTranslate("account.profile.signInDescription")}</p>
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
          <dl class="grid min-w-0 divide-y divide-line-subtle border-y border-line-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div class="min-w-0 px-3 py-2">
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.userName")}</dt>
              <dd class="truncate font-mono text-sm">{props.userName}</dd>
            </div>
            <div class="min-w-0 px-3 py-2">
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.email")}</dt>
              <dd class="truncate font-mono text-sm">{props.email}</dd>
            </div>
          </dl>
        </div>
      </div>
      <Show when={props.configuredSecurityMethodCount !== undefined}>
        <a
          class="flex min-w-0 items-center justify-between gap-3 border-t border-line-subtle px-3 py-2.5 transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href="#security"
        >
          <span class="text-sm font-medium">{messageTranslate("shell.nav.security")}</span>
          <span class="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold tabular-nums">
            {messageTranslate("account.security.progress", { count: props.configuredSecurityMethodCount ?? 0 })}
          </span>
        </a>
      </Show>
    </section>
  )
}
