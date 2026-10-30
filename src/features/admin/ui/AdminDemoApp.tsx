import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiDockLeft } from "@adaptive-ds/mdi/mdiDockLeft.js"
import { mdiMenu } from "@adaptive-ds/mdi/mdiMenu.js"
import { A, useLocation, useNavigate } from "@solidjs/router"
import { createEffect, For, type JSX, Show } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedBrandMark } from "../../../ui/authenticated/AuthenticatedBrandMark.js"
import { authenticatedNavigationClasses } from "../../../ui/authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { ProductionIdentityMenu } from "../../../ui/production/ProductionIdentityMenu.js"
import { adminDemoAppStateCreate } from "./adminDemoAppStateCreate.js"

function adminDemoHrefFor(access: () => string, href: string): string {
  const current = access()
  return current === "realm-admin" ? href : `${href}?as=${current}`
}

function AdminDemoSidebarToggle(props: { readonly state: ReturnType<typeof adminDemoAppStateCreate> }) {
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

function AdminDemoNavigation({ state }: { readonly state: ReturnType<typeof adminDemoAppStateCreate> }) {
  const hrefFor = (href: string) => adminDemoHrefFor(state.access, href)
  return (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <AuthenticatedBrandMark />
        <A class={authenticatedNavigationClasses.brandLink} href="/demo/admin" onClick={state.destinationSelect}>
          {messageTranslate("app.name")}
        </A>
        <Show when={state.collapseVisible()}>
          <AdminDemoSidebarToggle state={state} />
        </Show>
      </div>
      <nav aria-label={messageTranslate("admin.navigation.label")} class={authenticatedNavigationClasses.nav}>
        <A
          class={`${authenticatedNavigationClasses.link} ${authenticatedNavigationClasses.linkInactive} mb-1`}
          href="/demo"
          onClick={state.destinationSelect}
        >
          <Icon class="rtl:-scale-x-100" path={mdiArrowLeft} />
          <span class="truncate">{messageTranslate("demo.nav.label")}</span>
        </A>
        <For each={state.navigationGroups()}>
          {(group) => (
            <section class={authenticatedNavigationClasses.groupSection}>
              <Show
                when={group.label !== null}
                fallback={
                  <div class="grid">
                    <For each={group.items}>
                      {(item) => (
                        <A
                          aria-current={state.isActive(item.href) ? "page" : undefined}
                          class={authenticatedNavigationLinkClassGet(state.isActive(item.href))}
                          href={hrefFor(item.href)}
                          onClick={state.destinationSelect}
                        >
                          <Icon path={item.icon} />
                          <span class="truncate">{item.label}</span>
                        </A>
                      )}
                    </For>
                  </div>
                }
              >
                <button
                  aria-expanded={state.groupOpen(group)}
                  class={authenticatedNavigationClasses.groupHeading}
                  onClick={() => state.groupToggle(group)}
                  type="button"
                >
                  <Show when={group.icon}>{(icon) => <Icon class="size-4 shrink-0" path={icon()} />}</Show>
                  <span class="truncate">{state.groupLabel(group)}</span>
                  <Icon
                    class={`size-4 shrink-0 transition-transform ${state.groupOpen(group) ? "" : "-rotate-90"}`}
                    path={mdiChevronDown}
                  />
                </button>
                <Show when={state.groupOpen(group)}>
                  <div class="grid ps-2">
                    <For each={group.items}>
                      {(item) => (
                        <A
                          aria-current={state.isActive(item.href) ? "page" : undefined}
                          class={authenticatedNavigationLinkClassGet(state.isActive(item.href))}
                          href={hrefFor(item.href)}
                          onClick={state.destinationSelect}
                        >
                          <Icon path={item.icon} />
                          <span class="truncate">{item.label}</span>
                        </A>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </section>
          )}
        </For>
      </nav>
      <div class={authenticatedNavigationClasses.footer}>
        <ProductionIdentityMenu
          name={messageTranslate("demo.nav.label")}
          showProfile={false}
          onNavigate={state.destinationSelect}
        />
      </div>
    </div>
  )
}

const demoAdminRedirectTable: Readonly<Record<string, string>> = {
  "/demo/admin": "/demo/admin/users",
  "/demo/admin/branding": "/demo/admin/configuration/branding",
  "/demo/admin/configuration": "/demo/admin/configuration/general",
  "/demo/admin/domains": "/demo/admin/configuration/domains",
  "/demo/admin/invitations": "/demo/admin/users?tab=invitations",
  "/demo/admin/machine-users": "/demo/admin/users?tab=service-accounts",
  "/demo/admin/memberships": "/demo/admin/users",
  "/demo/admin/overview": "/demo/admin/realm",
}

export function AdminDemoApp(props: { children?: JSX.Element }) {
  const state = adminDemoAppStateCreate()
  const location = useLocation()
  const navigate = useNavigate()
  createEffect(() => {
    const asParam = state.access() === "realm-admin" ? "" : `?as=${state.access()}`
    const redirect = demoAdminRedirectTable[location.pathname]
    if (redirect !== undefined) navigate(`${redirect}${asParam}`, { replace: true })
  })
  return (
    <div class="authenticated-canvas min-h-dvh">
      <Sidebar
        defaultWidth={1024}
        state={state.sidebar}
        title={messageTranslate("admin.navigation.title")}
        description={messageTranslate("admin.navigation.description")}
        titleClass={authenticatedNavigationClasses.mobileTitle}
        descriptionClass={authenticatedNavigationClasses.mobileDescription}
        desktopChildren={
          <aside class={authenticatedNavigationClasses.aside}>
            <AdminDemoNavigation state={state} />
          </aside>
        }
        mobileChildren={
          <div class={authenticatedNavigationClasses.mobileContent}>
            <AdminDemoNavigation state={state} />
          </div>
        }
      />
      <main
        class="min-h-dvh transition-[margin] [&_section>*]:min-w-0"
        classList={{ [authenticatedNavigationClasses.contentOffset]: state.sidebar.openDesktop.get() }}
      >
        <Show when={state.topBarVisible()}>
          <div class={authenticatedNavigationClasses.topBar}>
            <AdminDemoSidebarToggle state={state} />
            <A class={authenticatedNavigationClasses.headerBrand} href="/demo/admin">
              <AuthenticatedBrandMark class={authenticatedNavigationClasses.headerBrandMark} />
              <span class={authenticatedNavigationClasses.brandLink}>{messageTranslate("app.name")}</span>
            </A>
          </div>
        </Show>
        <div class={authenticatedNavigationClasses.content}>{props.children}</div>
      </main>
    </div>
  )
}
