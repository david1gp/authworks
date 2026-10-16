import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { mdiMenuClose } from "@adaptive-ds/mdi/mdiMenuClose.js"
import { A } from "@solidjs/router"
import { For, type JSX, Show } from "solid-js"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedBrandMark } from "../../../ui/authenticated/AuthenticatedBrandMark.js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedThemeToggle } from "../../../ui/authenticated/AuthenticatedThemeToggle.js"
import { authenticatedNavigationClasses } from "../../../ui/authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { adminDemoAppStateCreate } from "./adminDemoAppStateCreate.js"

function AdminDemoNavigation({ state }: { readonly state: ReturnType<typeof adminDemoAppStateCreate> }) {
  return (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <AuthenticatedBrandMark />
        <A class={authenticatedNavigationClasses.brandLink} href="/demo/admin" onClick={state.destinationSelect}>
          {messageTranslate("app.name")}
        </A>
      </div>
      <nav aria-label={messageTranslate("admin.navigation.label")} class={authenticatedNavigationClasses.nav}>
        <A
          class={`${authenticatedNavigationClasses.link} ${authenticatedNavigationClasses.linkInactive} mb-1`}
          href="/demo"
          onClick={state.destinationSelect}
        >
          <Icon path={mdiArrowLeft} />
          <span class="truncate">{messageTranslate("demo.nav.label")}</span>
        </A>
        <For each={state.navigationGroups}>
          {(group) => (
            <section class={authenticatedNavigationClasses.groupSection}>
              <h2 class={authenticatedNavigationClasses.groupHeading}>
                <span class="truncate">{ttc(group.label)}</span>
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
                      <span class="truncate">{ttc(item.label)}</span>
                    </A>
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </nav>
      <div class={authenticatedNavigationClasses.footer}>
        <AuthenticatedButton
          class={authenticatedNavigationClasses.footerButton}
          icon={mdiMenuClose}
          size="sm"
          variant="ghost"
          onClick={state.hideSidebar}
        >
          {messageTranslate("admin.navigation.hide")}
        </AuthenticatedButton>
      </div>
    </div>
  )
}

export function AdminDemoApp(props: { children?: JSX.Element }) {
  const state = adminDemoAppStateCreate()
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
        <header class={authenticatedNavigationClasses.header}>
          <div class={authenticatedNavigationClasses.headerStart}>
            <SidebarToggle {...state.sidebar} class={authenticatedNavigationClasses.sidebarToggle} variant="ghost" />
            <Show when={state.showHeaderBrand()}>
              <A class={authenticatedNavigationClasses.headerBrand} href="/demo/admin">
                <AuthenticatedBrandMark class={authenticatedNavigationClasses.headerBrandMark} />
                <span class={authenticatedNavigationClasses.brandLink}>{messageTranslate("app.name")}</span>
              </A>
            </Show>
          </div>
          <div class={authenticatedNavigationClasses.headerEnd}>
            <A class={authenticatedNavigationClasses.headerLink} href="/demo">
              {messageTranslate("demo.nav.label")}
            </A>
            <LanguageSelector class="authenticated-language-selector" />
            <AuthenticatedThemeToggle class="hidden sm:inline-flex" />
            <ThemeButton class="sm:hidden" />
          </div>
        </header>
        <div class={authenticatedNavigationClasses.content}>{props.children}</div>
      </main>
    </div>
  )
}
