import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { AuthenticatedThemeToggle } from "../../../ui/authenticated/AuthenticatedThemeToggle.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { AccountAccessDemoAdapter } from "./AccountAccessDemoAdapter.js"
import { AccountWorkspaceDemoAdapter } from "./AccountWorkspaceDemoAdapter.js"
import type { accountDemoAppStateCreate } from "./accountDemoAppStateCreate.js"

export function AccountDemoScreen(props: { state: ReturnType<typeof accountDemoAppStateCreate> }) {
  return (
    <div class="min-h-dvh bg-muted transition-colors">
      <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div class="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <A class="truncate text-sm font-semibold tracking-tight text-foreground" href="/demo">
              {messageTranslate("app.name")}
            </A>
          </div>
          <div class="flex min-w-0 items-center gap-2">
            <A
              class="hidden text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/login"
            >
              {messageTranslate("demo.nav.login")}
            </A>
            <A
              class="hidden text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/admin"
            >
              {messageTranslate("demo.nav.admin")}
            </A>
            <Show when={!props.state.isWorkspace()}>
              <LanguageSelector class="authenticated-language-selector" />
              <AuthenticatedThemeToggle class="hidden sm:inline-flex" />
              <ThemeButton class="size-8 shrink-0 p-0 sm:hidden" />
            </Show>
          </div>
        </div>
      </header>
      <main class="mx-auto w-full max-w-[1760px] px-4 py-4 sm:px-6 sm:py-6">
        <Show when={props.state.accessScreen()} fallback={<AccountWorkspaceDemoAdapter />}>
          {(screen) => (
            <div class="mx-auto grid min-w-0 max-w-6xl gap-3 [&>*]:min-w-0">
              <h1 class="sr-only">
                {screen() === "invitation"
                  ? messageTranslate("demo.account.scenario.invitation.title")
                  : messageTranslate("demo.account.scenario.invitations.title")}
              </h1>
              <AccountAccessDemoAdapter screen={screen()} />
            </div>
          )}
        </Show>
      </main>
    </div>
  )
}
