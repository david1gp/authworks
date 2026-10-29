import { mdiAlertCircleOutline } from "@adaptive-ds/mdi/mdiAlertCircleOutline.js"
import { mdiCheckCircleOutline } from "@adaptive-ds/mdi/mdiCheckCircleOutline.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiChevronRight } from "@adaptive-ds/mdi/mdiChevronRight.js"
import { mdiShieldKeyOutline } from "@adaptive-ds/mdi/mdiShieldKeyOutline.js"
import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"

/**
 * Subtle dense recovery/MFA overview inside the profile card. The one-line summary keeps
 * the progress bar; each overview row is an anchor link jumping to the matching card
 * inside the security section.
 */
export function AccountSecurityProgress(props: {
  readonly state: ReturnType<typeof accountSecurityProgressStateCreate>
}) {
  return (
    <details class="group/progress min-w-0" data-account-security-progress>
      <summary class="-mx-2 flex min-w-0 cursor-pointer list-none flex-wrap items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-nowrap [&::-webkit-details-marker]:hidden">
        <h2 class="order-1 flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex-none">
          <Icon class="size-4 shrink-0 text-accent" path={mdiShieldKeyOutline} />
          <span class="truncate">{messageTranslate("account.security.recoveryMfa")}</span>
        </h2>
        <div class="order-3 flex w-full min-w-0 flex-wrap items-center gap-2.5 max-sm:gap-y-1 sm:w-auto sm:flex-1 sm:flex-nowrap">
          <div
            aria-label={props.state.accessibleLabel()}
            aria-valuemax={6}
            aria-valuemin={0}
            aria-valuenow={props.state.configuredCount()}
            class="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted max-sm:basis-full"
            role="progressbar"
          >
            <div
              aria-hidden="true"
              class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: props.state.width() }}
            />
          </div>
          <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{props.state.text()}</span>
        </div>
        <Icon
          aria-hidden="true"
          class="order-2 size-4 shrink-0 text-muted-foreground transition-transform group-open/progress:rotate-180 sm:order-4"
          path={mdiChevronDown}
        />
      </summary>
      <ul class="mt-1 grid min-w-0 gap-x-4 sm:grid-cols-2 xl:grid-cols-3">
        <For each={props.state.items()}>
          {(item) => (
            <li class="min-w-0">
              <a
                class="flex min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-xs transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                href={item.href}
                title={item.detail}
              >
                <Icon
                  aria-hidden="true"
                  class={item.configured ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-danger"}
                  path={item.configured ? mdiCheckCircleOutline : mdiAlertCircleOutline}
                />
                <span class="inline-flex min-w-0 flex-1 items-baseline gap-1 truncate">
                  <span class="shrink-0 font-medium text-foreground">{item.label}</span>
                  <span class="min-w-0 flex-1 truncate text-muted-foreground">{item.detail}</span>
                </span>
                <span class="sr-only">
                  {messageTranslate(item.configured ? "account.status.configured" : "account.status.notConfigured")}
                </span>
                <Icon aria-hidden="true" class="size-3.5 shrink-0 text-muted-foreground" path={mdiChevronRight} />
              </a>
            </li>
          )}
        </For>
      </ul>
    </details>
  )
}
