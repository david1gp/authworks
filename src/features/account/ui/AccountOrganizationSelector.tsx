import { For, Show } from "solid-js"
import { SelectSingleNative } from "#ui/input/select/SelectSingleNative.jsx"
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
        class="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1"
        role="tablist"
      >
        <For each={props.organizations}>
          {(item) => {
            const id = () => item.organization.id
            const selected = () => state.selected(id())
            return (
              <button
                aria-controls={props.panelId}
                aria-selected={selected()}
                class={classMerge(
                  "shrink-0 rounded-control border px-2.5 py-1.5 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                  selected() ? "border-line bg-muted font-medium" : "border-transparent text-muted-foreground",
                )}
                id={`${props.panelId}-tab-${id()}`}
                onClick={() => state.tabSelect(id())}
                onKeyDown={state.tabKeyDown}
                ref={(element) => state.tabRefSet(id(), element)}
                role="tab"
                tabIndex={state.tabIndexGet(id())}
                type="button"
              >
                {item.organization.name}
                <Show when={id() === props.activeOrganizationId}>
                  <span class="ml-1.5 text-xs text-accent">{messageTranslate("account.access.active")}</span>
                </Show>
              </button>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
