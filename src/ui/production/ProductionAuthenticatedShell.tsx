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

/** Compact authenticated frame: hairline rail navigation, dense groups, and a slim collapsed top bar. */
export function ProductionAuthenticatedShell(props: {
  readonly children: JSX.Element
  readonly kind: "account" | "admin" | "invitations"
  readonly title: MessageKey
}) {
  const state = productionAuthenticatedShellStateCreate(() => props.kind)
  const title = () => messageTranslate(props.title)
  const homeHref = () => (props.kind === "admin" ? "/admin" : "/account")
  const navigation = (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <A class={authenticatedNavigationClasses.brandLink} href={homeHref()} onClick={state.destinationSelect}>
          {messageTranslate("app.name")}
        </A>
        <SidebarToggle {...state.sidebar} variant="ghost" />
      </div>
      <nav aria-label={title()} class={authenticatedNavigationClasses.nav}>
        <Show when={state.showAdminNavigation()}>
          <A
            aria-current={state.isActive("/admin") ? "page" : undefined}
            class={`${authenticatedNavigationLinkClassGet(state.isActive("/admin"))} mb-1`}
            href="/admin"
            onClick={state.destinationSelect}
          >
            <Icon path={mdiShieldLockOutline} />
            {messageTranslate("admin.navigation.label")}
          </A>
        </Show>
        <Show when={state.showAccountNavigation()}>
          <A
            aria-current={state.isActive("/account") ? "page" : undefined}
            class={`${authenticatedNavigationLinkClassGet(state.isActive("/account"))} mb-1`}
            href="/account"
            onClick={state.destinationSelect}
          >
            <Icon path={mdiAccountCircleOutline} />
            {messageTranslate("shell.nav.account")}
          </A>
        </Show>
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
      <div class={authenticatedNavigationClasses.footer}>
        <Show when={state.organizationSwitchable()}>
          <label class="mb-2 grid gap-1">
            <span class="flex items-center gap-2 px-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Icon path={mdiOfficeBuildingOutline} />
              {messageTranslate("shell.nav.organization")}
            </span>
            <select
              aria-label={messageTranslate("shell.nav.organization")}
              class="min-w-0 rounded-control border border-line bg-surface px-2 py-1 text-[0.8125rem] text-foreground"
              value={state.organizationId()}
              onChange={(event) => state.session.organizationSelect(event.currentTarget.value)}
            >
              <For each={state.session.organizations}>
                {(organization) => <option value={organization.id}>{organization.label}</option>}
              </For>
            </select>
          </label>
        </Show>
        <div class="flex items-center gap-2 rounded-control px-1 py-1">
          <span
            aria-hidden="true"
            class="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent"
          >
            {state.actorInitial()}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[0.8125rem] font-medium leading-5">{state.session.actorLabel}</p>
            <Show
              when={!state.organizationSwitchable() && state.organizationLabel()}
              fallback={
                <p class="truncate text-2xs text-muted-foreground">{messageTranslate("login.signedIn.title")}</p>
              }
            >
              <p class="truncate text-2xs text-muted-foreground">{state.organizationLabel()}</p>
            </Show>
          </div>
          <A
            aria-label={messageTranslate("common.signOut")}
            class="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            href={state.signOutHref}
            title={messageTranslate("common.signOut")}
          >
            <Icon path={mdiLogout} />
          </A>
        </div>
        <div class="mt-1 flex items-center justify-between gap-2 border-t border-line-subtle pt-2">
          <LanguageSelector />
          <ThemeButton />
        </div>
      </div>
    </div>
  )

  return (
    <div class="min-h-dvh bg-muted">
      <ProductionImpersonationBannerSlot />
      <Sidebar
        state={state.sidebar}
        title={messageTranslate("shell.nav.navigationTitle", { title: title() })}
        description={messageTranslate("shell.nav.chooseDestination")}
        desktopChildren={<aside class={authenticatedNavigationClasses.aside}>{navigation}</aside>}
        mobileChildren={navigation}
      />
      <div class={`min-h-dvh ${state.sidebar.openDesktop.get() ? authenticatedNavigationClasses.contentOffset : ""}`}>
        <Show when={state.navigationHidden()}>
          <header class="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface px-2">
            <SidebarToggle {...state.sidebar} variant="ghost" />
            <A class="min-w-0 truncate text-sm font-semibold tracking-tight" href={homeHref()}>
              {messageTranslate("app.name")}
            </A>
          </header>
        </Show>
        <main class="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">{props.children}</main>
      </div>
    </div>
  )
}
