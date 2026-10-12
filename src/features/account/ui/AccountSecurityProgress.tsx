import { mdiShieldKeyOutline } from "@adaptive-ds/mdi/mdiShieldKeyOutline.js"
import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

/**
 * Expandable recovery/MFA overview inside the profile card. The summary keeps the progress bar;
 * each overview row is an anchor link jumping to the matching card inside the security section.
 */
export function AccountSecurityProgress(props: {
  readonly state: ReturnType<typeof accountSecurityProgressStateCreate>
}) {
  return (
    <details
      class="group/progress grid min-w-0 gap-0 rounded-control border border-line-subtle"
      data-account-security-progress
    >
      <summary class="grid min-w-0 cursor-pointer list-none gap-2 px-3 py-2.5 transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
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
      </summary>
      <ul class="grid min-w-0 divide-y divide-line-subtle border-t border-line-subtle">
        <For each={props.state.items()}>
          {(item) => (
            <li class="min-w-0">
              <a
                class="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                href={item.href}
              >
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-muted-foreground">{item.label}</span>
                  <span class="block break-words text-sm font-medium">{item.detail}</span>
                </span>
                <span
                  class="shrink-0 text-xs font-medium"
                  classList={{ "text-success": item.configured, "text-muted-foreground": !item.configured }}
                >
                  {messageTranslate(item.configured ? "account.status.configured" : "account.status.notConfigured")}
                </span>
              </a>
            </li>
          )}
        </For>
      </ul>
    </details>
  )
}
