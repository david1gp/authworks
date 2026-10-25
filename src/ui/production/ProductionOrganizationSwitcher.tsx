import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { mdiUnfoldMoreHorizontal } from "@adaptive-ds/mdi/mdiUnfoldMoreHorizontal.js"
import Popover from "@corvu/popover"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import type { ProductionContextOption } from "./productionContextOption.js"
import { productionOrganizationSwitcherStateCreate } from "./productionOrganizationSwitcherStateCreate.js"

/**
 * Sidebar organization switcher: a workspace-style card (initials tile, name, caption) that opens a
 * width-matched listbox. With a single organization it renders as a static card without a menu.
 */
export function ProductionOrganizationSwitcher(props: {
  readonly activeId: string
  readonly error: string | undefined
  readonly onSelect: (organizationId: string) => void
  readonly organizations: readonly ProductionContextOption[]
  readonly pending: boolean
  readonly switchable: boolean
}) {
  const state = productionOrganizationSwitcherStateCreate({
    activeId: () => props.activeId,
    disabled: () => !props.switchable || props.pending,
    onSelect: (organizationId) => props.onSelect(organizationId),
    organizations: () => props.organizations,
  })

  const identity = () => (
    <>
      <span aria-hidden="true" class={classMerge(authenticatedNavigationClasses.organizationTile, state.activeTone())}>
        {state.activeInitials()}
      </span>
      <span class="grid min-w-0 flex-1 text-start leading-tight">
        <span class={authenticatedNavigationClasses.organizationCaption}>
          {messageTranslate("shell.nav.organizationSwitcher")}
        </span>
        <span class={authenticatedNavigationClasses.organizationName} title={state.activeLabel()}>
          {state.activeLabel()}
        </span>
      </span>
    </>
  )

  return (
    <div class={authenticatedNavigationClasses.organizationSwitcher}>
      <Show
        when={props.switchable}
        fallback={<div class={authenticatedNavigationClasses.organizationCard}>{identity()}</div>}
      >
        <Popover
          floatingOptions={{ flip: true, offset: 6, shift: true, size: { fitViewPort: true, matchSize: true } }}
          onOpenChange={state.openChange}
          open={state.open()}
          placement="bottom-start"
        >
          <Popover.Trigger
            aria-busy={props.pending}
            aria-haspopup="listbox"
            aria-label={`${messageTranslate("shell.nav.organizationSwitcher")}: ${state.activeLabel()}`}
            class={classMerge(
              authenticatedNavigationClasses.organizationCard,
              authenticatedNavigationClasses.organizationTrigger,
            )}
            disabled={props.pending}
          >
            {identity()}
            <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={mdiUnfoldMoreHorizontal} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class={authenticatedNavigationClasses.organizationMenu} data-organization-switcher-menu="">
              <Show when={state.searchVisible()}>
                <label class={authenticatedNavigationClasses.organizationSearch}>
                  <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={mdiMagnify} />
                  <input
                    aria-label={messageTranslate("shell.nav.organizationSwitcherSearch")}
                    class="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-muted-foreground"
                    onInput={state.queryInput}
                    onKeyDown={state.searchKeyDown}
                    placeholder={messageTranslate("shell.nav.organizationSwitcherSearch")}
                    type="search"
                    value={state.query()}
                  />
                </label>
              </Show>
              <div
                aria-label={messageTranslate("shell.nav.organizationSwitcher")}
                class="grid max-h-72 gap-0.5 overflow-y-auto overscroll-contain p-1"
                role="listbox"
              >
                <For
                  each={state.filtered()}
                  fallback={
                    <p class="px-2.5 py-2 text-[0.8125rem] text-muted-foreground">
                      {messageTranslate("shell.nav.organizationSwitcherEmpty")}
                    </p>
                  }
                >
                  {(organization) => (
                    <button
                      aria-selected={state.isActive(organization.id)}
                      class={authenticatedNavigationClasses.organizationOption}
                      onClick={() => state.select(organization.id)}
                      onKeyDown={state.optionKeyDown}
                      role="option"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        class={classMerge(
                          authenticatedNavigationClasses.organizationOptionTile,
                          state.tone(organization.label),
                        )}
                      >
                        {state.initials(organization.label)}
                      </span>
                      <span class="min-w-0 flex-1 truncate" title={organization.label}>
                        {organization.label}
                      </span>
                      <Show when={state.isActive(organization.id)}>
                        <Icon aria-hidden="true" class="size-4 shrink-0 text-accent" path={mdiCheck} />
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </Show>
      <Show when={props.error}>
        {(error) => (
          <span aria-live="assertive" class="sr-only" role="alert">
            {error()}
          </span>
        )}
      </Show>
    </div>
  )
}
