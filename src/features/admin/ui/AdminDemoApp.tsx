import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Sidebar } from "#ui/interactive/sidebar/Sidebar.jsx"
import { SidebarToggle } from "#ui/interactive/sidebar/SidebarToggle.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { adminDemoAppStateCreate } from "./adminDemoAppStateCreate.js"

export function AdminDemoApp(props: { children?: JSX.Element }) {
  const state = adminDemoAppStateCreate()
  return (
    <div class="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <Sidebar
        state={state.sidebar}
        title={messageTranslate("admin.navigation.title")}
        description={messageTranslate("admin.navigation.description")}
        desktopChildren={
          <aside class="fixed inset-y-0 z-20 w-64 overflow-y-auto overscroll-contain border-gray-200 bg-white p-4 ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l dark:border-gray-800 dark:bg-gray-900">
            <AdminSidebarContent state={state} />
          </aside>
        }
        mobileChildren={<AdminSidebarContent state={state} />}
      />
      <main class="min-h-dvh transition-[margin] lg:ltr:ml-64 lg:rtl:mr-64">
        <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <SidebarToggle {...state.sidebar} variant="ghost" />
          <div class="flex items-center gap-2">
            <LanguageSelector />
            <ThemeButton />
            <A class="text-sm text-muted-foreground hover:underline" href="/demo">
              {messageTranslate("demo.nav.label")}
            </A>
          </div>
        </header>
        <div class="p-4 sm:p-6">{props.children}</div>
      </main>
    </div>
  )
}

function AdminSidebarContent(props: { state: ReturnType<typeof adminDemoAppStateCreate> }) {
  return (
    <div class="grid gap-2">
      <div class="flex items-center justify-between gap-2 px-2 py-2">
        <div>
          <p class="text-lg font-semibold">{messageTranslate("app.name")}</p>
          <p class="text-xs text-muted-foreground">{messageTranslate("admin.navigation.label")}</p>
        </div>
      </div>
      <A class="mb-2 px-2 text-sm text-muted-foreground hover:underline" href="/demo">
        <span aria-hidden="true">←</span> {messageTranslate("demo.nav.label")}
      </A>
      <nav aria-label={messageTranslate("admin.navigation.label")} class="grid gap-4">
        {props.state.navigationGroups.map((group) => (
          <div class="grid gap-1">
            <p class="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {ttc(group.label)}
            </p>
            {group.items.map((item) => (
              <A
                class={`rounded-md px-3 py-2 text-sm font-medium ${props.state.isActive(item.href) ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                href={item.href}
              >
                {ttc(item.label)}
              </A>
            ))}
          </div>
        ))}
      </nav>
      <Button class="mt-4 justify-start" variant="ghost" onClick={() => props.state.sidebar.openDesktop.set(false)}>
        {messageTranslate("admin.navigation.hide")}
      </Button>
    </div>
  )
}
