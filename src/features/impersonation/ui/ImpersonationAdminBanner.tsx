import { mdiAccountSwitchOutline } from "@adaptive-ds/mdi/mdiAccountSwitchOutline.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { ImpersonationAdminSession } from "./impersonationAdminAdapter.js"
import { impersonationAdminRemainingFormat } from "./impersonationAdminRemainingFormat.js"

/**
 * The persistent impersonation banner. It names the acting administrator and the subject,
 * counts down to the enforced expiry, links to the matching audit events, and always offers
 * an explicit end action. It never renders any session credential.
 */
export function ImpersonationAdminBanner(props: {
  readonly eventsHref: string
  readonly onEnd: () => void
  readonly pending: boolean
  readonly remainingSeconds: number
  readonly session: ImpersonationAdminSession
}) {
  const remaining = () => impersonationAdminRemainingFormat(props.remainingSeconds)
  return (
    <aside
      aria-label={messageTranslate("admin.impersonation.bannerLabel")}
      class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-warning/35 bg-warning-soft px-4 sm:px-6 py-2 text-[0.8125rem] text-warning"
      data-impersonation-banner
    >
      <div class="flex min-w-0 flex-1 basis-full items-start gap-2.5 sm:basis-0">
        <Icon aria-hidden="true" class="mt-0.5 size-4 shrink-0" path={mdiAccountSwitchOutline} />
        <p class="min-w-0 break-words font-medium" data-impersonation-summary>
          {messageTranslate("admin.impersonation.bannerSummary", {
            actor: props.session.actorLabel,
            remaining: remaining(),
            subject: props.session.subjectLabel,
          })}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <Show when={props.remainingSeconds < 60}>
          <span class="text-xs font-medium" role="status">
            {messageTranslate("admin.impersonation.expiringSoon")}
          </span>
        </Show>
        <A class="text-xs font-medium underline underline-offset-2" href={props.eventsHref}>
          {messageTranslate("admin.impersonation.auditLink")}
        </A>
        <AuthenticatedButton
          size="sm"
          disabled={props.pending}
          icon={mdiLogout}
          onClick={props.onEnd}
          variant="outline"
        >
          {messageTranslate("admin.impersonation.end")}
        </AuthenticatedButton>
      </div>
    </aside>
  )
}
