import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiCheckDecagram } from "@adaptive-ds/mdi/mdiCheckDecagram.js"
import { mdiClockOutline } from "@adaptive-ds/mdi/mdiClockOutline.js"
import { mdiEmailOutline } from "@adaptive-ds/mdi/mdiEmailOutline.js"
import { mdiPhoneOutline } from "@adaptive-ds/mdi/mdiPhoneOutline.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountIdentityCopyButton } from "./AccountIdentityCopyButton.js"
import { AccountProfilePictureField } from "./AccountProfilePictureField.js"
import { AccountSecurityProgress } from "./AccountSecurityProgress.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
import type { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

export function AccountProfileIdentityStrip(props: {
  readonly displayName: string
  readonly email: string
  readonly emailVerified: boolean
  readonly onPictureRemove: () => void
  readonly onPictureUpload: (file: File) => void
  readonly pictureErrorMessage?: string
  readonly pictureStatus: AccountPictureViewStatus
  readonly pictureUrl: string
  readonly phoneNumber?: string
  readonly phoneVerified: boolean
  readonly securityProgress?: ReturnType<typeof accountSecurityProgressStateCreate>
  readonly userName: string
}) {
  const emailTitle = () =>
    !props.email
      ? messageTranslate("account.profile.emailMissing")
      : messageTranslate(props.emailVerified ? "account.profile.verified" : "account.profile.verificationPending")
  const phoneTitle = () =>
    !props.phoneNumber
      ? messageTranslate("account.profile.notSet")
      : messageTranslate(props.phoneVerified ? "account.profile.verified" : "account.profile.verificationPending")

  return (
    <div class="rounded-panel border border-line bg-surface p-4 sm:p-5">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 sm:gap-x-6">
        <div class="col-start-1 row-start-1 grid min-w-0 gap-1">
          <div class="flex min-w-0 items-center gap-1.5 text-lg font-semibold">
            <Icon
              aria-label={messageTranslate("account.profile.displayName")}
              class="size-5 shrink-0 text-accent"
              path={mdiAccountOutline}
              title={messageTranslate("account.profile.displayName")}
            />
            <span
              class="min-w-0 break-words"
              classList={{
                "font-normal text-muted-foreground": !props.displayName,
              }}
            >
              {props.displayName || messageTranslate("account.profile.notSet")}
            </span>
            {props.displayName ? (
              <AccountIdentityCopyButton
                label={messageTranslate("account.profile.displayName")}
                value={props.displayName}
              />
            ) : null}
          </div>
          <div
            class="flex min-w-0 items-center gap-1.5 font-mono text-sm text-muted-foreground"
            title={messageTranslate("account.profile.userName")}
          >
            <span class="min-w-0 break-all">
              {props.userName ? `@${props.userName}` : messageTranslate("account.profile.notSet")}
            </span>
            {props.userName ? (
              <AccountIdentityCopyButton label={messageTranslate("account.profile.userName")} value={props.userName} />
            ) : null}
          </div>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm">
            <div class="flex min-w-0 items-center gap-1.5">
              <Icon
                aria-label={messageTranslate("account.profile.email")}
                class="size-4 shrink-0 text-accent"
                path={mdiEmailOutline}
                title={messageTranslate("account.profile.email")}
              />
              <span
                class="min-w-0 break-all"
                classList={{
                  "text-muted-foreground": !props.email,
                }}
              >
                {props.email || messageTranslate("account.profile.notSet")}
              </span>
              {props.email ? (
                <>
                  <AccountIdentityCopyButton label={messageTranslate("account.profile.email")} value={props.email} />
                  <Icon
                    aria-label={emailTitle()}
                    class={props.emailVerified ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-warning"}
                    path={props.emailVerified ? mdiCheckDecagram : mdiClockOutline}
                    title={emailTitle()}
                  />
                </>
              ) : null}
            </div>
            <div class="flex min-w-0 items-center gap-1.5">
              <Icon
                aria-label={messageTranslate("account.profile.phoneNumber")}
                class="size-4 shrink-0 text-accent"
                path={mdiPhoneOutline}
                title={messageTranslate("account.profile.phoneNumber")}
              />
              <span
                class="min-w-0 break-all"
                classList={{
                  "text-muted-foreground": !props.phoneNumber,
                }}
              >
                {props.phoneNumber || messageTranslate("account.profile.notSet")}
              </span>
              {props.phoneNumber ? (
                <>
                  <AccountIdentityCopyButton
                    label={messageTranslate("account.profile.phoneNumber")}
                    value={props.phoneNumber}
                  />
                  <Icon
                    aria-label={phoneTitle()}
                    class={props.phoneVerified ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-warning"}
                    path={props.phoneVerified ? mdiCheckDecagram : mdiClockOutline}
                    title={phoneTitle()}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        {props.securityProgress ? (
          <div class="col-span-2 row-start-2 min-w-0 border-t border-line-subtle pt-2 sm:col-span-1 sm:col-start-1">
            <AccountSecurityProgress state={props.securityProgress} />
          </div>
        ) : null}
        <div
          class="col-start-2 row-start-1 shrink-0 self-start"
          classList={{
            "sm:row-span-2": Boolean(props.securityProgress),
            "sm:self-center": Boolean(props.securityProgress),
          }}
        >
          <AccountProfilePictureField
            errorMessage={props.pictureErrorMessage}
            onRemove={props.onPictureRemove}
            onUpload={props.onPictureUpload}
            status={props.pictureStatus}
            url={props.pictureUrl}
          />
        </div>
      </div>
    </div>
  )
}
