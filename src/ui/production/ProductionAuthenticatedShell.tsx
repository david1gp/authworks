import { A } from "@solidjs/router"
import { For, type JSX } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { ttc } from "../i18n/model/ttc.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { ProductionImpersonationBannerSlot } from "./ProductionImpersonationBannerSlot.js"
import { productionAuthenticatedShellStateCreate } from "./productionAuthenticatedShellStateCreate.js"

export function ProductionAuthenticatedShell(props: {
  readonly children: JSX.Element
  readonly kind: "account" | "admin" | "invitations"
  readonly title: string
}) {
  const state = productionAuthenticatedShellStateCreate(() => props.kind)
  const navigation = (
    <div class="flex h-full flex-col">
      <div class="border-b border-line px-5 py-5">
        <A class="text-xl font-bold tracking-tight" href={props.kind === "admin" ? "/admin" : "/account"}>
          Authworks
        </A>
        <p class="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{props.title}</p>
      </div>
      <nav aria-label={props.title} class="flex-1 overflow-y-auto px-3 py-4">
        <For each={state.groups()}>
          {(group) => (
            <section class="mb-5">
              <h2 class="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {ttc(group.label)}
              </h2>
              <div class="grid gap-0.5">
                <For each={group.items}>
                  {(item) => (
                    <A
                      aria-current={state.isActive(item.href) ? "page" : undefined}
                      class={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        state.isActive(item.href)
                          ? "bg-accent text-accent-contrast shadow-sm"
                          : "text-foreground hover:bg-muted"
                      }`}
                      href={item.href}
                    >
                      {ttc(item.label)}
                    </A>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </nav>
      <div class="border-t border-line p-4">
        <p class="truncate text-sm font-medium">{state.session.actorLabel}</p>
        <p class="text-xs text-muted-foreground">{ttc("Signed in")}</p>
      </div>
    </div>
  )

  return (
    <div class="min-h-dvh bg-muted/50">
      <ProductionImpersonationBannerSlot />
      <Sidebar
        state={state.sidebar}
        title={ttc("{title} navigation", { title: props.title })}
        description={ttc("Choose a destination")}
        desktopChildren={
          <aside class="fixed inset-y-0 left-0 z-20 w-72 border-r border-line bg-surface">{navigation}</aside>
        }
        mobileChildren={navigation}
      />
      <div class="min-h-dvh lg:ml-72">
        <header class="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <SidebarToggle {...state.sidebar} variant="ghost" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{props.title}</p>
            <p class="hidden truncate text-xs text-muted-foreground sm:block">{state.session.actorLabel}</p>
          </div>
          <label class="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span>{ttc("Realm")}</span>
            <select
              aria-label={ttc("Realm")}
              class="max-w-44 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground"
              value={state.realmId()}
              onChange={(event) => state.session.realmSelect(event.currentTarget.value)}
            >
              <For each={state.session.realms}>{(realm) => <option value={realm.id}>{realm.label}</option>}</For>
            </select>
          </label>
          <label class="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
            <span>{ttc("Organization")}</span>
            <select
              aria-label={ttc("Organization")}
              class="max-w-44 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground"
              value={state.organizationId()}
              onChange={(event) => state.session.organizationSelect(event.currentTarget.value)}
            >
              <For each={state.session.organizations}>
                {(organization) => <option value={organization.id}>{organization.label}</option>}
              </For>
            </select>
          </label>
          <LanguageSelector class="hidden sm:inline-flex" />
          <ThemeButton />
        </header>
        <main class="px-4 py-7 sm:px-6 sm:py-9 lg:px-10">{props.children}</main>
      </div>
    </div>
  )
}
