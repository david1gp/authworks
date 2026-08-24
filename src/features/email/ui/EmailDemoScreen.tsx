import { A } from "@solidjs/router"
import { Match, Switch } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { DemoNav } from "../../demo/ui/DemoNav.js"
import { EmailDemoDirectory } from "./EmailDemoDirectory.js"
import { EmailPreviewPage } from "./EmailPreviewPage.js"
import type { emailDemoAppStateCreate } from "./emailDemoAppStateCreate.js"

type EmailDemoState = ReturnType<typeof emailDemoAppStateCreate>

export function EmailDemoScreen(props: { state: EmailDemoState }) {
  return (
    <div class="min-h-dvh bg-background">
      <header class="border-b border-line bg-surface/90 backdrop-blur">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex min-w-0 items-center gap-4">
            <A class="font-semibold tracking-tight" href="/demo">
              {messageTranslate("app.name")}
            </A>
            <span class="hidden h-5 w-px bg-line sm:block" />
            <span class="hidden text-sm text-muted-foreground sm:block">
              {messageTranslate("email.directory.title")}
            </span>
          </div>
          <div class="flex min-w-0 items-center gap-2 sm:gap-3">
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/login"
            >
              {messageTranslate("demo.nav.login")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/account"
            >
              {messageTranslate("demo.nav.account")}
            </A>
            <A
              class="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
              href="/demo/admin"
            >
              {messageTranslate("demo.nav.admin")}
            </A>
            <LanguageSelector />
            <ThemeButton />
          </div>
        </div>
      </header>
      <div class="flex min-h-[calc(100dvh-57px)] flex-col gap-4 p-3 sm:p-4 lg:flex-row">
        <DemoNav compact={props.state.isCompact()} onNavigate={props.state.go} onToggle={props.state.toggleCompact} />
        <main class="min-w-0 flex-1 py-2">
          <Switch
            fallback={
              <section class="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
                <h1 class="text-2xl font-semibold">{messageTranslate("email.preview.notFound")}</h1>
              </section>
            }
          >
            <Match when={props.state.isDirectory()}>
              <EmailDemoDirectory />
            </Match>
            <Match when={props.state.fixture()}>{(fixture) => <EmailPreviewPage fixture={fixture()} />}</Match>
          </Switch>
        </main>
      </div>
    </div>
  )
}
