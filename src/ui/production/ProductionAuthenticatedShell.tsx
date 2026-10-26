import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiDockLeft } from "@adaptive-ds/mdi/mdiDockLeft.js"
import { mdiMenu } from "@adaptive-ds/mdi/mdiMenu.js"
import { A } from "@solidjs/router"
import { For, type JSX, Show } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { classMerge } from "#ui/utils/classMerge.js"
import { AuthenticatedThemeToggle } from "../authenticated/AuthenticatedThemeToggle.js"
import { authenticatedAvatarColorGet } from "../authenticated/authenticatedAvatarColorGet.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../authenticated/authenticatedNavigationLinkClassGet.js"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { ProductionIdentityMenu } from "./ProductionIdentityMenu.js"
import { ProductionImpersonationBannerSlot } from "./ProductionImpersonationBannerSlot.js"
import { ProductionOrganizationSwitcher } from "./ProductionOrganizationSwitcher.js"
import { ProductionOrganizationTile } from "./ProductionOrganizationTile.js"
import { productionAuthenticatedShellStateCreate } from "./productionAuthenticatedShellStateCreate.js"
import type { ProductionNavigationItem } from "./productionNavigationItem.js"

type ProductionAuthenticatedShellState = ReturnType<typeof productionAuthenticatedShellStateCreate>

function ProductionSidebarToggle(props: { readonly state: ProductionAuthenticatedShellState }) {
  return (
    <SidebarToggle
      {...props.state.sidebar}
      class={authenticatedNavigationClasses.sidebarToggle}
      iconClass="size-4.5 rtl:-scale-x-100"
      iconDesktopOpen={mdiDockLeft}
      iconDesktopClose={mdiDockLeft}
      iconMobileOpen={mdiMenu}
      iconMobileClose={mdiMenu}
      variant="ghost"
    />
  )
}

function ProductionSidebarFooter(props: { readonly state: ProductionAuthenticatedShellState }) {
  return (
    <div class={authenticatedNavigationClasses.footer}>
      <div class={authenticatedNavigationClasses.footerPreferences}>
        <LanguageSelector class="authenticated-language-selector min-w-0" />
        <AuthenticatedThemeToggle />
      </div>
      <ProductionIdentityMenu
        name={props.state.session.actorLabel}
        pictureUrl={props.state.session.actorPictureUrl}
        showProfile={props.state.showAccountNavigation()}
        signOutHref={props.state.signOutHref}
        onNavigate={props.state.destinationSelect}
      />
    </div>
  )
}

function ProductionContextualNavigation(props: { readonly state: ProductionAuthenticatedShellState }) {
  const navigationLink = (item: ProductionNavigationItem) => (
    <A
      aria-current={props.state.isItemActive(item.href) ? "page" : undefined}
      class={authenticatedNavigationLinkClassGet(props.state.isItemActive(item.href))}
      href={item.href}
      onClick={props.state.destinationSelect}
    >
      <Icon path={item.icon} />
      <span class="truncate">{messageTranslate(item.label)}</span>
    </A>
  )
  return (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.contextRow}>
        <ProductionOrganizationSwitcher
          activeId={props.state.organizationId()}
          error={props.state.organizationError()}
          onSelect={props.state.organizationSelect}
          organizations={props.state.session.organizations}
          pending={props.state.organizationSwitchPending()}
          realmLabel={props.state.realmLabel()}
          switchable={props.state.organizationSwitchable()}
        />
        <Show when={props.state.collapseVisible()}>
          <ProductionSidebarToggle state={props.state} />
        </Show>
      </div>
      <nav aria-label={props.state.title()} class={authenticatedNavigationClasses.nav}>
        <For each={props.state.groups()}>
          {(group) => (
            <section class={authenticatedNavigationClasses.groupSection}>
              <Show
                when={group.label}
                fallback={
                  <div class="grid">
                    <For each={group.items}>{navigationLink}</For>
                  </div>
                }
              >
                {(label) => (
                  <>
                    <button
                      aria-expanded={props.state.groupOpen(group)}
                      class={authenticatedNavigationClasses.groupHeading}
                      onClick={() => props.state.groupToggle(group)}
                      type="button"
                    >
                      <Show when={group.icon}>{(icon) => <Icon class="size-4 shrink-0" path={icon()} />}</Show>
                      <span class="truncate">{messageTranslate(label())}</span>
                      <Icon
                        class={`size-4 shrink-0 transition-transform ${props.state.groupOpen(group) ? "" : "-rotate-90 rtl:rotate-90"}`}
                        path={mdiChevronDown}
                      />
                    </button>
                    <Show when={props.state.groupOpen(group)}>
                      <div class="grid ps-2">
                        <For each={group.items}>{navigationLink}</For>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </section>
          )}
        </For>
      </nav>
      <ProductionSidebarFooter state={props.state} />
    </div>
  )
}

/**
 * Production authenticated frame. Contextual shells (administration, invitations) carry all global
 * controls — organization, language, theme, identity, sign-out — inside the sidebar; a slim top bar
 * carrying the active organization context only appears on mobile or while the desktop rail is
 * collapsed. The account workspace renders its own toolbar and therefore gets no shell chrome.
 */
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
        <Show when={props.kind !== "account" && state.topBarVisible()}>
          <div class={authenticatedNavigationClasses.topBar}>
            <ProductionSidebarToggle state={state} />
            <Show
              fallback={<span class={authenticatedNavigationClasses.brandLink}>{state.realmLabel()}</span>}
              when={state.activeOrganization()}
            >
              {(organization) => (
                <A class={authenticatedNavigationClasses.headerBrand} href={state.homeHref()}>
                  <ProductionOrganizationTile
                    imageUrl={organization().imageUrl}
                    label={organization().label}
                    tileClass={classMerge(
                      authenticatedNavigationClasses.organizationTile,
                      authenticatedAvatarColorGet(organization().label),
                    )}
                  />
                  <span class="grid min-w-0 flex-1 text-start leading-tight">
                    <Show when={state.realmLabel().length > 0}>
                      <span class={authenticatedNavigationClasses.organizationCaption}>{state.realmLabel()}</span>
                    </Show>
                    <span class={authenticatedNavigationClasses.brandLink} title={organization().label}>
                      {organization().label}
                    </span>
                  </span>
                </A>
              )}
            </Show>
          </div>
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
