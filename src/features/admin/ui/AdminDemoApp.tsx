import { mdiArrowLeft } from "@adaptive-ds/mdi/mdiArrowLeft.js"
import { A } from "@solidjs/router"
import { For, type JSX } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { authenticatedNavigationClasses } from "../../../ui/authenticated/authenticatedNavigationClasses.js"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { adminDemoAppStateCreate } from "./adminDemoAppStateCreate.js"

export function AdminDemoApp(props: { children?: JSX.Element }) {
  const state = adminDemoAppStateCreate()
  const navigation = (
    <div class={authenticatedNavigationClasses.frame}>
      <div class={authenticatedNavigationClasses.brandRow}>
        <A class={authenticatedNavigationClasses.brandLink} href="/demo/admin" onClick={state.destinationSelect}>
          {messageTranslate("app.name")}
        </A>
        <SidebarToggle {...state.sidebar} variant="ghost" />
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
                <Icon path={group.icon} />
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
        <Button
          class="h-7 w-full justify-start text-xs"
          variant="ghost"
          onClick={() => state.sidebar.openDesktop.set(false)}
        >
          {messageTranslate("admin.navigation.hide")}
        </Button>
      </div>
    </div>
  )

  return (
    <div class="min-h-dvh bg-muted">
      <Sidebar
        state={state.sidebar}
        title={messageTranslate("admin.navigation.title")}
        description={messageTranslate("admin.navigation.description")}
        desktopChildren={<aside class={authenticatedNavigationClasses.aside}>{navigation}</aside>}
        mobileChildren={navigation}
      />
      <main
        class="min-h-dvh transition-[margin] [&_section>*]:min-w-0"
        classList={{ [authenticatedNavigationClasses.contentOffset]: state.sidebar.openDesktop.get() }}
      >
        <header class={`sticky top-0 z-10 justify-between bg-surface ${authenticatedNavigationClasses.brandRow}`}>
          <SidebarToggle {...state.sidebar} variant="ghost" />
          <div class="flex min-w-0 items-center gap-2">
            <LanguageSelector />
            <ThemeButton />
            <A class="text-[0.8125rem] text-muted-foreground hover:text-foreground" href="/demo">
              {messageTranslate("demo.nav.label")}
            </A>
          </div>
        </header>
        <div class="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">{props.children}</div>
      </main>
    </div>
  )
}
