import type { JSX } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { productionFocusShellStateCreate } from "./productionFocusShellStateCreate.js"

export function ProductionFocusShell(props: { readonly children: JSX.Element; readonly title: string }) {
  const state = productionFocusShellStateCreate()
  return (
    <PageWrapper class="min-h-dvh" innerClass="relative flex min-h-dvh items-center justify-center py-12">
      <header class="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSelector />
        <ThemeButton />
      </header>
      <main class="w-full max-w-xl" data-shell="focus">
        <CardWrapper class="overflow-hidden border-line p-0 shadow-xl shadow-black/5">
          <header class="border-b border-line bg-surface px-6 py-6 sm:px-9">
            <div class="mb-5 flex items-center gap-3">
              <span class="grid size-10 place-items-center rounded-xl bg-accent text-lg font-bold text-accent-contrast">
                A
              </span>
              <div>
                <p class="font-semibold">{messageTranslate("app.name")}</p>
                <p class="text-xs text-muted-foreground">{state.realmLabel()}</p>
              </div>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">{props.title}</h1>
          </header>
          <div class="bg-surface p-5 sm:p-8">{props.children}</div>
        </CardWrapper>
        <p class="mt-5 text-center text-xs text-muted-foreground">{messageTranslate("app.tagline")}</p>
      </main>
    </PageWrapper>
  )
}
