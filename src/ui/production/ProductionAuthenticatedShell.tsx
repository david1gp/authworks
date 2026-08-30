import { mdiAccountCircleOutline } from "@adaptive-ds/mdi/mdiAccountCircleOutline.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiShieldLockOutline } from "@adaptive-ds/mdi/mdiShieldLockOutline.js"
import { A } from "@solidjs/router"
import { For, type JSX, Show } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../authenticated/authenticatedNavigationLinkClassGet.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { ProductionImpersonationBannerSlot } from "./ProductionImpersonationBannerSlot.js"
import { productionAuthenticatedShellStateCreate } from "./productionAuthenticatedShellStateCreate.js"

/** Production authenticated frame with sticky global navbar, contextual sidebar navigation, and account section navigation. */
export function ProductionAuthenticatedShell(props: {
  readonly children: JSX.Element
  readonly kind: "account" | "admin" | "invitations"
  readonly title: MessageKey
}) {
  const state = productionAuthenticatedShellStateCreate(
    () => props.kind,
    () => props.title,
  )

  const contextualNavigation = (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <A class={authenticatedNavigationClasses.brandLink} href={state.homeHref()} onClick={state.destinationSelect}>
          {messageTranslate("app.name")}
        </A>
      </div>
      <nav aria-label={state.title()} class={authenticatedNavigationClasses.nav}>
        <For each={state.groups()}>
          {(group) => (
            <section class={authenticatedNavigationClasses.groupSection}>
              <h2 class={authenticatedNavigationClasses.groupHeading}>
                <Icon path={group.icon} />
                <span class="truncate">{messageTranslate(group.label)}</span>
              </h2>
              <div class="grid">
                <For each={group.items}>
                  {(item) => (
                    <A
                      aria-current={state.isActive(item.href) ? "page" : undefined}
                      class={authenticatedNavigationLinkClassGet(state.isActive(item.href))}
                      href={item.href}
                      onClick={state.destinationSelect}
                    >
                      <Icon path={item.icon} />
                      <span class="truncate">{messageTranslate(item.label)}</span>
                    </A>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </nav>
    </div>
  )

  return (
    <div class="min-h-dvh bg-muted">
      <ProductionImpersonationBannerSlot />
      <header class="sticky top-0 z-30 flex h-12 min-w-0 items-center justify-between gap-1.5 border-b border-line bg-surface px-2.5 sm:gap-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-1 sm:gap-2">
          <Show when={state.isContextual()}>
            <SidebarToggle {...state.sidebar} variant="ghost" />
          </Show>
          <A class="shrink-0 text-sm font-semibold tracking-tight text-foreground" href={state.homeHref()}>
            {messageTranslate("app.name")}
          </A>
          <Show when={state.showAdminNavigation()}>
            <A
              aria-current={state.isActive("/admin") ? "page" : undefined}
              aria-label={messageTranslate("admin.navigation.label")}
              class="flex shrink-0 items-center gap-1 rounded-control px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:px-2"
              href="/admin"
              title={messageTranslate("admin.navigation.label")}
            >
              <Icon path={mdiShieldLockOutline} />
              <span class="hidden sm:inline">{messageTranslate("admin.navigation.label")}</span>
            </A>
          </Show>
          <Show when={state.showAccountNavigation()}>
            <A
              aria-current={state.isActive("/account") ? "page" : undefined}
              aria-label={messageTranslate("shell.nav.account")}
              class="flex shrink-0 items-center gap-1 rounded-control px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:px-2"
              href="/account"
              title={messageTranslate("shell.nav.account")}
            >
              <Icon path={mdiAccountCircleOutline} />
              <span class="hidden sm:inline">{messageTranslate("shell.nav.account")}</span>
            </A>
          </Show>
          <Show when={!state.isContextual()}>
            <nav
              aria-label={messageTranslate("shell.nav.navigationTitle", {
                title: messageTranslate("shell.nav.account"),
              })}
              class="flex min-w-0 items-center gap-1 overflow-x-auto"
            >
              <For each={state.accountSections()}>
                {(item) => (
                  <a
                    aria-current={state.isAccountSectionActive(item.id) ? "location" : undefined}
                    aria-label={messageTranslate(item.label)}
                    class={`${authenticatedNavigationLinkClassGet(state.isAccountSectionActive(item.id))} shrink-0 gap-1 px-1.5 py-1 text-xs sm:px-2`}
                    href={item.href}
                    title={messageTranslate(item.label)}
                  >
                    <Icon path={item.icon} />
                    <span class="hidden sm:inline">{messageTranslate(item.label)}</span>
                  </a>
                )}
              </For>
            </nav>
          </Show>
        </div>

        <div class="flex shrink-0 items-center gap-1 sm:gap-2">
          <Show when={state.organizationSwitchable()}>
            <div class="flex min-w-0 items-center gap-1 text-xs">
              <Icon class="shrink-0 text-muted-foreground" path={mdiOfficeBuildingOutline} />
              <select
                aria-label={messageTranslate("shell.nav.organization")}
                class="max-w-20 truncate rounded-control border border-line bg-surface px-1 py-1 text-xs text-foreground sm:max-w-36 md:max-w-48"
                aria-busy={state.organizationSwitchPending()}
                disabled={state.organizationSwitchPending()}
                value={state.organizationId()}
                onChange={state.organizationChange}
              >
                <For each={state.session.organizations}>
                  {(organization) => <option value={organization.id}>{organization.label}</option>}
                </For>
              </select>
              <Show when={state.organizationError()}>
                {(error) => (
                  <span aria-live="assertive" class="sr-only" role="alert">
                    {error()}
                  </span>
                )}
              </Show>
            </div>
          </Show>
          <Show when={!state.organizationSwitchable() && state.organizationLabel().length > 0}>
            <div
              class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
              title={state.organizationLabel()}
            >
              <Icon class="shrink-0 text-muted-foreground" path={mdiOfficeBuildingOutline} />
              <span class="max-w-16 truncate text-xs font-medium text-foreground sm:max-w-32 md:max-w-48">
                {state.organizationLabel()}
              </span>
            </div>
          </Show>
          <LanguageSelector />
          <ThemeButton />
          <div class="flex shrink-0 items-center gap-1.5 border-l border-line-subtle pl-1.5 sm:gap-2 sm:pl-2">
            <span
              aria-hidden="true"
              class="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent"
            >
              {state.actorInitial()}
            </span>
            <span class="hidden max-w-36 truncate text-xs font-medium text-foreground sm:inline">
              {state.session.actorLabel}
            </span>
            <A
              aria-label={messageTranslate("common.signOut")}
              class="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              href={state.signOutHref}
              title={messageTranslate("common.signOut")}
            >
              <Icon path={mdiLogout} />
            </A>
          </div>
        </div>
      </header>

      <Show when={state.isContextual()}>
        <Sidebar
          state={state.sidebar}
          title={state.title()}
          description={messageTranslate("shell.nav.chooseDestination")}
          desktopChildren={<aside class={authenticatedNavigationClasses.aside}>{contextualNavigation}</aside>}
          mobileChildren={contextualNavigation}
        />
      </Show>

      <div class={`min-h-[calc(100dvh-3rem)] ${state.contentClass()}`}>
        <main class="mx-auto w-full max-w-[1760px] px-4 py-4 sm:px-6 sm:py-6 2xl:px-8">{props.children}</main>
      </div>
    </div>
  )
}
