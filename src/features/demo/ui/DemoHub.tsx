import { A } from "@solidjs/router"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { DemoCard } from "./DemoCard.js"

export function DemoHub() {
  return (
    <div class="min-h-dvh bg-background">
      <header class="border-b border-line bg-surface/90 backdrop-blur">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex min-w-0 items-center gap-4">
            <A class="font-semibold tracking-tight" href="/demo">
              {messageTranslate("app.name")}
            </A>
            <span class="hidden h-5 w-px bg-line sm:block" />
            <span class="hidden text-sm text-muted-foreground sm:block">{messageTranslate("demo.nav.hub")}</span>
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
      <PageWrapper innerClass="py-12 sm:py-16">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-4xl font-semibold tracking-tight">{messageTranslate("app.name")}</h1>
          <p class="mt-3 text-lg text-muted-foreground">{messageTranslate("demo.hub.description")}</p>
          <div class="mt-8 grid gap-6 md:grid-cols-2">
            <DemoCard
              title={() => messageTranslate("admin.navigation.label")}
              description={() => messageTranslate("demo.hub.adminDescription")}
              href="/demo/admin"
              linkLabel={() => messageTranslate("demo.hub.adminOpen")}
            />
            <DemoCard
              title={() => messageTranslate("email.directory.title")}
              description={() => messageTranslate("email.hub.description")}
              href="/demo/emails"
              linkLabel={() => messageTranslate("email.hub.open")}
            />
            <DemoCard
              title={() => messageTranslate("demo.nav.account")}
              description={() => messageTranslate("demo.hub.accountDescription")}
              href="/demo/account"
              linkLabel={() => messageTranslate("demo.hub.accountOpen")}
            />
            <DemoCard
              title={() => messageTranslate("demo.nav.login")}
              description={() => messageTranslate("demo.hub.loginDescription")}
              href="/demo/login"
              linkLabel={() => messageTranslate("demo.hub.loginOpen")}
            />
          </div>
        </div>
      </PageWrapper>
    </div>
  )
}
