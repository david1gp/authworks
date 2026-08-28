import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { ttc } from "../../../ui/i18n/model/ttc.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { demoAccountScenarioGroups } from "../../demo/demoAccountScenarioGroups.js"
import { DemoDirectory } from "../../demo/ui/DemoDirectory.js"
import { DemoScenarioPlaceholder } from "../../demo/ui/DemoScenarioPlaceholder.js"
import { AccountAccessDemoAdapter } from "./AccountAccessDemoAdapter.js"
import { AccountDemoAdapter } from "./AccountDemoAdapter.js"
import { AccountSecurityDemoAdapter } from "./AccountSecurityDemoAdapter.js"
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
            <span class="hidden h-4 w-px bg-line sm:block" />
            <span class="hidden truncate text-[0.8125rem] font-medium text-muted-foreground sm:block">
              {messageTranslate("demo.account.title")}
            </span>
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
            <LanguageSelector />
            <ThemeButton />
          </div>
        </div>
      </header>
      <main class="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
        <Show when={props.state.isDirectory()} fallback={<AccountDemoDestination state={props.state} />}>
          <DemoDirectory
            eyebrow={() => messageTranslate("demo.account.eyebrow")}
            title={() => messageTranslate("account.directory.title")}
            description={() => messageTranslate("demo.account.description")}
            groups={demoAccountScenarioGroups}
          />
        </Show>
      </main>
    </div>
  )
}

function AccountDemoDestination(props: { state: ReturnType<typeof accountDemoAppStateCreate> }) {
  return (
    <div class="mx-auto grid min-w-0 max-w-6xl gap-3 [&>*]:min-w-0">
      <div>
        <A class="text-[0.8125rem] font-medium text-accent hover:underline" href="/demo/account">
          {messageTranslate("demo.directory.back")}
        </A>
      </div>
      <Show
        when={props.state.accessScreen()}
        fallback={
          <Show
            when={props.state.securityScreen()}
            fallback={
              <Show
                when={props.state.kind()}
                fallback={<DemoScenarioPlaceholder backHref="/demo/account" groups={demoAccountScenarioGroups} />}
              >
                {(kind) => <AccountDemoAdapter kind={kind()} path={props.state.path()} />}
              </Show>
            }
          >
            {(screen) => <AccountSecurityDemoAdapter screen={screen()} />}
          </Show>
        }
      >
        {(screen) => <AccountAccessDemoAdapter screen={screen()} />}
      </Show>
    </div>
  )
}
