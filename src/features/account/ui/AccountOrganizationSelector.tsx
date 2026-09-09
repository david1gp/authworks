import { For, Show } from "solid-js"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
import { Button } from "#ui/interactive/button/Button.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationMe } from "../../organizations/public/organizationMeSchema.js"
import { accountOrganizationSelectorStateCreate } from "./accountOrganizationSelectorStateCreate.js"

/**
 * Organization picker for the account Access section. Small membership sets render as an ARIA tab
 * list with roving focus and arrow-key navigation; more than eight memberships fall back to a
 * native select, which stays usable on a phone.
 */
export function AccountOrganizationSelector(props: {
  readonly activeOrganizationId?: string
  readonly onSelect: (organizationId: string) => void
  readonly organizations: readonly OrganizationMe[]
  readonly panelId: string
  readonly viewedOrganizationId?: string
}) {
  const state = accountOrganizationSelectorStateCreate({
    activeOrganizationId: () => props.activeOrganizationId,
    onSelect: (organizationId) => props.onSelect(organizationId),
    organizations: () => props.organizations,
    viewedOrganizationId: () => props.viewedOrganizationId,
  })
  return (
    <Show
      when={props.organizations.length <= 8}
      fallback={
        <label class="grid gap-1" for={`${props.panelId}-select`}>
          <span class="sr-only">{messageTranslate("account.access.organizationSelector")}</span>
          <SelectSingleNative
            getOptions={() => [...state.organizationIds()]}
            id={`${props.panelId}-select`}
            valueSignal={state.selectValue}
            valueText={state.valueText}
          />
        </label>
      }
    >
      {/* Horizontal scrolling keeps every tab reachable on a narrow viewport without wrapping the row. */}
      <div
        aria-label={messageTranslate("account.access.organizationSelector")}
        class="flex min-w-0 gap-1.5 overflow-x-auto rounded-panel border border-line bg-muted/60 p-1.5 shadow-inner"
        role="tablist"
      >
        <For each={props.organizations}>
          {(item) => {
            const id = () => item.organization.id
            const selected = () => state.selected(id())
            return (
              <Button
                aria-controls={props.panelId}
                aria-selected={selected()}
                class={classMerge(
                  "shrink-0 gap-2 rounded-control border px-3.5 py-2 text-sm whitespace-nowrap shadow-none focus-visible:ring-accent",
                  selected()
                    ? "border-accent/50 bg-surface text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-line hover:bg-surface/70 hover:text-foreground",
                )}
                id={`${props.panelId}-tab-${id()}`}
                onClick={() => state.tabSelect(id())}
                onKeyDown={state.tabKeyDown}
                ref={(element) => state.tabRefSet(id(), element)}
                role="tab"
                size="none"
                tabIndex={state.tabIndexGet(id())}
                type="button"
                variant="none"
              >
                <span>{item.organization.name}</span>
                <Show when={id() === props.activeOrganizationId}>
                  <span class="rounded-full bg-accent/10 px-1.5 py-0.5 text-2xs font-semibold tracking-wide text-accent uppercase">
                    {messageTranslate("account.access.active")}
                  </span>
                </Show>
              </Button>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
