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
import { AuthenticatedBrandMark } from "../authenticated/AuthenticatedBrandMark.js"
import { AuthenticatedThemeToggle } from "../authenticated/AuthenticatedThemeToggle.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../authenticated/authenticatedNavigationLinkClassGet.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { ProductionImpersonationBannerSlot } from "./ProductionImpersonationBannerSlot.js"
import { productionAuthenticatedShellStateCreate } from "./productionAuthenticatedShellStateCreate.js"

function ProductionContextualNavigation(props: {
  readonly state: ReturnType<typeof productionAuthenticatedShellStateCreate>
}) {
  return (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <AuthenticatedBrandMark />
        <A
          class={authenticatedNavigationClasses.brandLink}
          href={props.state.homeHref()}
          onClick={props.state.destinationSelect}
        >
          {messageTranslate("app.name")}
        </A>
      </div>
      <nav aria-label={props.state.title()} class={authenticatedNavigationClasses.nav}>
        <For each={props.state.groups()}>
          {(group) => (
            <section class={authenticatedNavigationClasses.groupSection}>
              <h2 class={authenticatedNavigationClasses.groupHeading}>
                <span class="truncate">{messageTranslate(group.label)}</span>
              </h2>
              <div class="grid">
                <For each={group.items}>
                  {(item) => (
                    <A
                      aria-current={props.state.isActive(item.href) ? "page" : undefined}
                      class={authenticatedNavigationLinkClassGet(props.state.isActive(item.href))}
                      href={item.href}
                      onClick={props.state.destinationSelect}
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
}

/** Production authenticated frame with a global navbar, contextual sidebar navigation, and account section navigation. */
export function ProductionAuthenticatedShell(props: {
  readonly children: JSX.Element
  readonly kind: "account" | "admin" | "invitations"
  readonly title: MessageKey
}) {
  const state = productionAuthenticatedShellStateCreate(
    () => props.kind,
    () => props.title,
  )

  return (
    <div class="min-h-dvh authenticated-canvas">
      <Show when={state.isContextual()}>
        <Sidebar
          defaultWidth={1024}
          state={state.sidebar}
          title={state.title()}
          description={messageTranslate("shell.nav.chooseDestination")}
          titleClass={authenticatedNavigationClasses.mobileTitle}
          descriptionClass={authenticatedNavigationClasses.mobileDescription}
          desktopChildren={
            <aside class={authenticatedNavigationClasses.aside}>
              <ProductionContextualNavigation state={state} />
            </aside>
          }
          mobileChildren={
            <div class={authenticatedNavigationClasses.mobileContent}>
              <ProductionContextualNavigation state={state} />
            </div>
          }
        />
      </Show>
      <div class={`min-h-dvh min-w-0 transition-[margin] ${state.contentClass()}`}>
        <ProductionImpersonationBannerSlot />
        <Show when={props.kind !== "account"}>
          <header
            class={`${state.headerPositionClass()} ${authenticatedNavigationClasses.header} max-xl:gap-2 max-xl:px-4 max-sm:gap-1 max-sm:px-2`}
          >
            <div class={`${authenticatedNavigationClasses.headerStart} max-sm:gap-1`}>
              <Show when={state.isContextual()}>
                <SidebarToggle
                  {...state.sidebar}
                  class={authenticatedNavigationClasses.sidebarToggle}
                  variant="ghost"
                />
              </Show>
              <Show when={state.showHeaderBrand()}>
                <A
                  aria-label={messageTranslate("app.name")}
                  class={`${authenticatedNavigationClasses.headerBrand} shrink-0`}
                  href={state.homeHref()}
                >
                  <AuthenticatedBrandMark class={authenticatedNavigationClasses.headerBrandMark} />
                  <span class={`${authenticatedNavigationClasses.brandLink} hidden sm:inline`}>
                    {messageTranslate("app.name")}
                  </span>
                </A>
              </Show>
              <Show when={state.showAdminNavigation()}>
                <A
                  aria-current={state.isActive("/admin") ? "page" : undefined}
                  aria-label={messageTranslate("admin.navigation.label")}
                  class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent xl:px-2.5"
                  href="/admin"
                  title={messageTranslate("admin.navigation.label")}
                >
                  <Icon class="size-4 shrink-0" path={mdiShieldLockOutline} />
                  <span class="hidden xl:inline">{messageTranslate("admin.navigation.label")}</span>
                </A>
              </Show>
              <Show when={state.showAccountNavigation()}>
                <A
                  aria-current={state.isActive("/account") ? "page" : undefined}
                  aria-label={messageTranslate("shell.nav.account")}
                  class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent xl:px-2.5"
                  href="/account"
                  title={messageTranslate("shell.nav.account")}
                >
                  <Icon class="size-4 shrink-0" path={mdiAccountCircleOutline} />
                  <span class="hidden xl:inline">{messageTranslate("shell.nav.account")}</span>
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

            <div class={`${authenticatedNavigationClasses.headerEnd} max-xl:gap-1.5 max-sm:gap-1`}>
              <Show when={state.organizationSwitchable()}>
                <div class="authenticated-pill-select inline-flex min-w-0 items-center text-xs">
                  <Icon class="hidden shrink-0 sm:block" path={mdiOfficeBuildingOutline} />
                  <select
                    aria-label={messageTranslate("shell.nav.organization")}
                    class="max-w-10 truncate text-foreground sm:max-w-16 xl:max-w-28"
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
                  class="hidden h-8 min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-muted-foreground sm:flex"
                  title={state.organizationLabel()}
                >
                  <Icon class="size-4 shrink-0" path={mdiOfficeBuildingOutline} />
                  <span class="max-w-16 truncate font-medium text-foreground xl:max-w-28">
                    {state.organizationLabel()}
                  </span>
                </div>
              </Show>
              <LanguageSelector class="authenticated-language-selector max-sm:[&>select]:max-w-8 max-sm:[&>svg]:hidden sm:[&>select]:max-w-16 xl:[&>select]:max-w-none" />
              <AuthenticatedThemeToggle class="hidden sm:inline-flex" />
              <ThemeButton class="size-8 shrink-0 p-0 sm:hidden" />
              <div class="flex shrink-0 items-center gap-1 sm:gap-2">
                <span
                  aria-hidden="true"
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                >
                  {state.actorInitial()}
                </span>
                <span
                  class="hidden max-w-12 truncate text-[0.8125rem] font-medium text-foreground md:inline xl:max-w-24"
                  title={state.session.actorLabel}
                >
                  {state.session.actorLabel}
                </span>
                <A
                  aria-label={messageTranslate("common.signOut")}
                  class="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  href={state.signOutHref}
                  title={messageTranslate("common.signOut")}
                >
                  <Icon class="size-4" path={mdiLogout} />
                </A>
              </div>
            </div>
          </header>
        </Show>

        <main
          class={
            props.kind === "account"
              ? "mx-auto w-full max-w-[1760px] px-4 py-4 sm:px-6 sm:py-6 2xl:px-8"
              : authenticatedNavigationClasses.content
          }
        >
          {props.children}
        </main>
      </div>
    </div>
  )
}
