import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { AccountDisclosure } from "./AccountDisclosure.js"
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
    <AccountDisclosure
      icon={mdiAccountCircleOutline}
      open
      summary={messageTranslate("account.profile.signInTitle")}
      value={props.displayName || props.userName || props.email || messageTranslate("account.profile.notSet")}
      variant="card"
    >
      <div class="grid min-w-0 items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <AccountProfilePictureField
          errorMessage={props.pictureErrorMessage}
          onRemove={props.onPictureRemove}
          onUpload={props.onPictureUpload}
          status={props.pictureStatus}
          url={props.pictureUrl}
        />
        <div class="grid min-w-0 gap-3">
          <dl class="grid min-w-0 divide-y divide-line-subtle border-y border-line-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div class="min-w-0 py-2 sm:pr-3">
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.displayName")}</dt>
              <dd class="flex min-w-0 items-center gap-1 text-sm">
                <span class="min-w-0 break-all">{props.displayName || messageTranslate("account.profile.notSet")}</span>
                {props.displayName ? (
                  <AccountIdentityCopyButton
                    label={messageTranslate("account.profile.displayName")}
                    value={props.displayName}
                  />
                ) : null}
              </dd>
            </div>
            <div class="min-w-0 py-2 sm:pl-3">
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.userName")}</dt>
              <dd class="flex min-w-0 items-center gap-1 font-mono text-sm">
                <span class="min-w-0 break-all">{props.userName || messageTranslate("account.profile.notSet")}</span>
                {props.userName ? (
                  <AccountIdentityCopyButton
                    label={messageTranslate("account.profile.userName")}
                    value={props.userName}
                  />
                ) : null}
              </dd>
            </div>
          </dl>
          <dl class="grid min-w-0 divide-y divide-line-subtle border-y border-line-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div class="min-w-0 py-2 sm:pr-3" title={emailTitle()}>
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.email")}</dt>
              <dd class="flex min-w-0 items-center gap-1 font-mono text-sm">
                <span class="min-w-0 break-all">{props.email || messageTranslate("account.profile.notSet")}</span>
                {props.email ? (
                  <AccountIdentityCopyButton label={messageTranslate("account.profile.email")} value={props.email} />
                ) : null}
              </dd>
            </div>
            <div class="min-w-0 py-2 sm:pl-3" title={phoneTitle()}>
              <dt class="text-xs text-muted-foreground">{messageTranslate("account.profile.phoneNumber")}</dt>
              <dd class="flex min-w-0 items-center gap-1 font-mono text-sm">
                <span class="min-w-0 break-all">{props.phoneNumber || messageTranslate("account.profile.notSet")}</span>
                {props.phoneNumber ? (
                  <AccountIdentityCopyButton
                    label={messageTranslate("account.profile.phoneNumber")}
                    value={props.phoneNumber}
                  />
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      {props.securityProgress ? (
        <div class="mt-4">
          <AccountSecurityProgress state={props.securityProgress} />
        </div>
      ) : null}
    </AccountDisclosure>
  )
}
