import { mdiAccountCheckOutline } from "@adaptive-ds/mdi/mdiAccountCheckOutline.js"
import { mdiDomain } from "@adaptive-ds/mdi/mdiDomain.js"
import { mdiOfficeBuildingOutline } from "@adaptive-ds/mdi/mdiOfficeBuildingOutline.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { A } from "@solidjs/router"
import { For, type JSX, Show } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import type { MessageKey } from "../i18n/model/messageKeySchema.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { ProductionImpersonationBannerSlot } from "./ProductionImpersonationBannerSlot.js"
import { productionAuthenticatedShellStateCreate } from "./productionAuthenticatedShellStateCreate.js"

export function ProductionAuthenticatedShell(props: {
  readonly children: JSX.Element
  readonly kind: "account" | "admin" | "invitations"
  readonly title: MessageKey
}) {
  const state = productionAuthenticatedShellStateCreate(() => props.kind)
  const title = () => messageTranslate(props.title)
  const navigation = (
    <div class="flex h-full flex-col">
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <A
          class="min-w-0 flex-1 truncate text-xl font-bold tracking-tight"
          href={props.kind === "admin" ? "/admin" : "/account"}
        >
          {messageTranslate("app.name")}
        </A>
        <SidebarToggle {...state.sidebar} variant="ghost" />
      </div>
      <nav aria-label={title()} class="flex-1 overflow-y-auto px-2 py-2">
        <For each={state.groups()}>
          {(group) => (
            <section class="mb-3">
              <h2 class="mb-0.5 flex items-center gap-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Icon path={group.icon} />
                {messageTranslate(group.label)}
              </h2>
              <div class="grid gap-0.5">
                <For each={group.items}>
                  {(item) => (
                    <A
                      aria-current={state.isActive(item.href) ? "page" : undefined}
                      class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                        state.isActive(item.href)
                          ? "bg-accent text-accent-contrast shadow-sm"
                          : "text-foreground hover:bg-muted"
                      }`}
                      href={item.href}
                    >
                      <Icon path={item.icon} />
                      {messageTranslate(item.label)}
                    </A>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
        <div class="grid gap-2 border-t border-line px-2 py-3">
          <label class="grid gap-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-2">
              <Icon path={mdiDomain} />
              {messageTranslate("shell.nav.realm")}
            </span>
            <select
              aria-label={messageTranslate("shell.nav.realm")}
              class="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground"
              value={state.realmId()}
              onChange={(event) => state.session.realmSelect(event.currentTarget.value)}
            >
              <For each={state.session.realms}>{(realm) => <option value={realm.id}>{realm.label}</option>}</For>
            </select>
          </label>
          <label class="grid gap-1 text-xs text-muted-foreground">
            <span class="flex items-center gap-2">
              <Icon path={mdiOfficeBuildingOutline} />
              {messageTranslate("shell.nav.organization")}
            </span>
            <select
              aria-label={messageTranslate("shell.nav.organization")}
              class="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground"
              value={state.organizationId()}
              onChange={(event) => state.session.organizationSelect(event.currentTarget.value)}
            >
              <For each={state.session.organizations}>
                {(organization) => <option value={organization.id}>{organization.label}</option>}
              </For>
            </select>
          </label>
          <div class="flex items-center justify-between gap-2">
            <LanguageSelector />
            <ThemeButton />
          </div>
        </div>
        <div class="px-2 pb-2 pt-1">
          <p class="truncate text-sm font-medium">{state.session.actorLabel}</p>
          <p class="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon path={mdiAccountCheckOutline} />
            {messageTranslate("login.signedIn.title")}
          </p>
          <A
            class="mt-1 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            href={state.signOutHref}
          >
            <Icon path={mdiLogout} />
            {messageTranslate("common.signOut")}
          </A>
        </div>
      </nav>
    </div>
  )

  return (
    <div class="min-h-dvh bg-muted/50">
      <ProductionImpersonationBannerSlot />
      <Sidebar
        state={state.sidebar}
        title={messageTranslate("shell.nav.navigationTitle", { title: title() })}
        description={messageTranslate("shell.nav.chooseDestination")}
        desktopChildren={
          <aside class="fixed inset-y-0 left-0 z-20 w-72 border-r border-line bg-surface">{navigation}</aside>
        }
        mobileChildren={navigation}
      />
      <Show
        when={
          (state.sidebar.isMobile.get() && !state.sidebar.openMobile.get()) ||
          (!state.sidebar.isMobile.get() && !state.sidebar.openDesktop.get())
        }
      >
        <SidebarToggle {...state.sidebar} class="fixed left-3 top-3 z-30 bg-surface shadow-sm" variant="ghost" />
      </Show>
      <div class={`min-h-dvh ${state.sidebar.openDesktop.get() ? "lg:ml-72" : ""}`}>
        <main
          class={`px-4 py-7 sm:px-6 sm:py-9 lg:px-10 ${
            (state.sidebar.isMobile.get() && !state.sidebar.openMobile.get()) ||
            (!state.sidebar.isMobile.get() && !state.sidebar.openDesktop.get())
              ? "pt-16"
              : ""
          }`}
        >
          {props.children}
        </main>
      </div>
    </div>
  )
}
