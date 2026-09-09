import { mdiShieldKeyOutline } from "@adaptive-ds/mdi/mdiShieldKeyOutline.js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

export function AccountSecurityProgress(props: {
  readonly state: ReturnType<typeof accountSecurityProgressStateCreate>
}) {
  return (
    <a
      class="grid min-w-0 gap-2 border-t border-line-subtle px-3 py-2.5 transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      data-account-security-progress
      href="#security"
    >
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 class="flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-tight">
          <Icon class="size-4 text-muted-foreground" path={mdiShieldKeyOutline} />
          <span class="truncate">{messageTranslate("account.security.recoveryMfa")}</span>
        </h2>
        <span class="shrink-0 text-xs font-semibold tabular-nums text-foreground">{props.state.text()}</span>
      </div>
      <div
        aria-label={props.state.accessibleLabel()}
        aria-valuemax={5}
        aria-valuemin={0}
        aria-valuenow={props.state.configuredCount()}
        class="h-2 w-full min-w-0 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-line-subtle"
        role="progressbar"
      >
        <div
          aria-hidden="true"
          class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: props.state.width() }}
        />
      </div>
    </a>
  )
}
