import { mdiCheck } from "@adaptive-ds/mdi/mdiCheck.js"
import { mdiMagnify } from "@adaptive-ds/mdi/mdiMagnify.js"
import { mdiUnfoldMoreHorizontal } from "@adaptive-ds/mdi/mdiUnfoldMoreHorizontal.js"
import Popover from "@corvu/popover"
import { For, Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { ProductionOrganizationTile } from "./ProductionOrganizationTile.js"
import type { ProductionContextOption } from "./productionContextOption.js"
import { productionOrganizationSwitcherStateCreate } from "./productionOrganizationSwitcherStateCreate.js"

/**
 * Sidebar administration context switcher: a workspace-style card that opens a
 * width-matched listbox with a Realm entry (realm administrators only) followed
 * by organizations. Selecting the realm shows realm administration entries in
 * the sidebar; selecting an organization shows organization entries. There is no
 * collapsible Realm group.
 */
export function ProductionOrganizationSwitcher(props: {
  readonly activeOrganizationId: string
  readonly activeScope: "organization" | "realm"
  readonly canAccessRealm: boolean
  readonly error: string | undefined
  readonly onOrganizationSelect: (organizationId: string) => void
  readonly onRealmSelect: () => void
  readonly organizations: readonly ProductionContextOption[]
  readonly pending: boolean
  readonly realmId: string
  readonly realmLabel: string
  readonly switchable: boolean
}) {
  const state = productionOrganizationSwitcherStateCreate({
    activeId: () => props.activeOrganizationId,
    disabled: () => !props.switchable || props.pending,
    onSelect: (organizationId) => props.onOrganizationSelect(organizationId),
    organizations: () => props.organizations,
  })

  const activeLabel = () => (props.activeScope === "realm" ? props.realmLabel : state.activeLabel())

  const realmQueryVisible = () => {
    const needle = state.query().trim().toLocaleLowerCase()
    if (needle.length === 0) return true
    return props.realmLabel.toLocaleLowerCase().includes(needle)
  }

  const realmVisible = () => props.canAccessRealm && realmQueryVisible()

  const searchVisible = () => props.organizations.length + (props.canAccessRealm ? 1 : 0) > 7

  const realmSelect = () => {
    state.openChange(false)
    if (props.activeScope === "realm") return
    props.onRealmSelect()
  }

  const identity = () => (
    <>
      <ProductionOrganizationTile
        imageUrl={props.activeScope === "realm" ? undefined : state.activeImageUrl()}
        label={activeLabel()}
        tileClass={classMerge(authenticatedNavigationClasses.organizationTile, state.activeTone())}
      />
      <span class="grid min-w-0 flex-1 text-start leading-tight">
        <Show
          fallback={
            <span class={authenticatedNavigationClasses.organizationCaption}>
              {messageTranslate("shell.nav.realmGroup")}
            </span>
          }
          when={props.activeScope === "organization" && props.realmLabel.length > 0}
        >
          <span class={authenticatedNavigationClasses.organizationCaption} title={props.realmLabel}>
            {props.realmLabel}
          </span>
        </Show>
        <span class={authenticatedNavigationClasses.organizationName} title={activeLabel()}>
          {activeLabel()}
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
            aria-label={`${messageTranslate("shell.nav.organizationSwitcher")}: ${activeLabel()}`}
            class={classMerge(
              authenticatedNavigationClasses.organizationCard,
              authenticatedNavigationClasses.organizationTrigger,
            )}
            data-admin-context-switcher=""
            disabled={props.pending}
          >
            {identity()}
            <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={mdiUnfoldMoreHorizontal} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content class={authenticatedNavigationClasses.organizationMenu} data-organization-switcher-menu="">
              <Show when={searchVisible()}>
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
                <Show when={realmVisible()}>
                  <p class="px-2.5 pt-1.5 pb-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {messageTranslate("shell.nav.realmGroup")}
                  </p>
                  <button
                    aria-selected={props.activeScope === "realm"}
                    class={authenticatedNavigationClasses.organizationOption}
                    data-admin-context-option="realm"
                    disabled={props.pending}
                    onClick={realmSelect}
                    onKeyDown={state.optionKeyDown}
                    role="option"
                    type="button"
                  >
                    <ProductionOrganizationTile
                      imageUrl={undefined}
                      label={props.realmLabel}
                      tileClass={classMerge(
                        authenticatedNavigationClasses.organizationOptionTile,
                        state.tone(props.realmLabel),
                      )}
                    />
                    <span class="min-w-0 flex-1 truncate" title={props.realmLabel}>
                      {props.realmLabel}
                    </span>
                    <Show when={props.activeScope === "realm"}>
                      <Icon aria-hidden="true" class="size-4 shrink-0 text-accent" path={mdiCheck} />
                    </Show>
                  </button>
                </Show>
                <Show when={props.canAccessRealm}>
                  <p class="px-2.5 pt-1.5 pb-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    {messageTranslate("shell.nav.organizations")}
                  </p>
                </Show>
                <For
                  each={state.filtered()}
                  fallback={
                    <Show
                      fallback={
                        <p class="px-2.5 py-2 text-[0.8125rem] text-muted-foreground">
                          {messageTranslate("shell.nav.organizationSwitcherEmpty")}
                        </p>
                      }
                      when={realmVisible()}
                    >
                      <span />
                    </Show>
                  }
                >
                  {(organization) => (
                    <button
                      aria-selected={props.activeScope === "organization" && state.isActive(organization.id)}
                      class={authenticatedNavigationClasses.organizationOption}
                      data-admin-context-option="organization"
                      onClick={() => state.select(organization.id)}
                      onKeyDown={state.optionKeyDown}
                      role="option"
                      type="button"
                    >
                      <ProductionOrganizationTile
                        imageUrl={state.imageUrl(organization.id)}
                        label={organization.label}
                        tileClass={classMerge(
                          authenticatedNavigationClasses.organizationOptionTile,
                          state.tone(organization.label),
                        )}
                      />
                      <span class="min-w-0 flex-1 truncate" title={organization.label}>
                        {organization.label}
                      </span>
                      <Show when={props.activeScope === "organization" && state.isActive(organization.id)}>
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
