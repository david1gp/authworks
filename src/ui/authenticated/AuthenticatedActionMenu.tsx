import { mdiDotsVertical } from "@adaptive-ds/mdi/mdiDotsVertical.js"
import Popover from "@corvu/popover"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import type { AuthenticatedActionMenuItem } from "./authenticatedActionMenuItem.js"
import { authenticatedActionMenuStateCreate } from "./authenticatedActionMenuStateCreate.js"
import { authenticatedButtonClassGet } from "./authenticatedButtonClassGet.js"

/**
 * Overflow ("...") menu for row and card actions. The corvu popover closes on selection; menu
 * items stay keyboard navigable with arrow keys, Home/End, and Escape.
 */
export function AuthenticatedActionMenu(props: {
  readonly class?: string
  readonly icon?: string
  readonly items: readonly AuthenticatedActionMenuItem[]
  readonly label?: string
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}) {
  const state = authenticatedActionMenuStateCreate({
    onOpenChange: (open) => props.onOpenChange?.(open),
  })
  return (
    <Popover
      floatingOptions={{ flip: true, offset: 8, shift: true }}
      onOpenChange={(open) => props.onOpenChange?.(open)}
      open={props.open}
    >
      <Popover.Trigger
        aria-label={props.label ?? messageTranslate("ui.authenticated.moreActions")}
        class={classMerge(authenticatedButtonClassGet("ghost", "sm", true), props.class)}
        title={props.label ?? messageTranslate("ui.authenticated.moreActions")}
      >
        <Icon aria-hidden="true" class="size-4.5" path={props.icon ?? mdiDotsVertical} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="z-50 min-w-44 rounded-control border border-line bg-surface p-1 text-sm shadow-overlay data-open:animate-in data-open:fade-in-50% data-closed:animate-out data-closed:fade-out-50%">
          <div role="menu">
            <For each={props.items}>
              {(item) => (
                <Popover.Close
                  aria-disabled={item.disabled}
                  class={classMerge(
                    "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-start text-[0.8125rem] font-medium transition-colors",
                    item.disabled
                      ? "cursor-not-allowed opacity-50"
                      : item.tone === "danger"
                        ? "text-danger hover:bg-danger-soft"
                        : "text-foreground hover:bg-surface-hover",
                  )}
                  disabled={item.disabled}
                  onClick={state.select(item)}
                  onKeyDown={state.itemKeyDown()}
                  role="menuitem"
                >
                  <Show when={item.icon}>
                    {(icon) => <Icon aria-hidden="true" class="size-4 shrink-0" path={icon()} />}
                  </Show>
                  <span class="truncate">{item.label}</span>
                </Popover.Close>
              )}
            </For>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
