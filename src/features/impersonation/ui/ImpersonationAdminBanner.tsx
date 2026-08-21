import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { impersonationAdminRemainingFormat } from "./impersonationAdminRemainingFormat.js"
import type { ImpersonationAdminSession } from "./impersonationAdminAdapter.js"

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
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
      data-impersonation-banner
      role="region"
    >
      <p class="min-w-0 font-medium" data-impersonation-summary>
        {messageTranslate("admin.impersonation.bannerSummary", {
          actor: props.session.actorLabel,
          remaining: remaining(),
          subject: props.session.subjectLabel,
        })}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <Show when={props.remainingSeconds < 60}>
          <span class="text-xs font-semibold uppercase tracking-wider" role="status">
            {messageTranslate("admin.impersonation.expiringSoon")}
          </span>
        </Show>
        <A class="text-sm font-medium underline underline-offset-2" href={props.eventsHref}>
          {messageTranslate("admin.impersonation.auditLink")}
        </A>
        <Button disabled={props.pending} onClick={props.onEnd} size="sm" variant="outline">
          {messageTranslate("admin.impersonation.end")}
        </Button>
      </div>
    </aside>
  )
}
