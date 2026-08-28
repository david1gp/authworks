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
        <CardWrapper class="overflow-hidden rounded-panel border-line p-0 shadow-sm shadow-black/5">
          <header class="border-b border-line bg-surface px-5 py-4 sm:px-6">
            <div class="mb-3 flex items-center gap-2.5">
              <span class="grid size-8 place-items-center rounded-control bg-accent text-sm font-bold text-accent-contrast">
                A
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{messageTranslate("app.name")}</p>
                <p class="truncate text-2xs text-muted-foreground">{state.realmLabel()}</p>
              </div>
            </div>
            <h1 class="text-lg font-semibold tracking-tight sm:text-xl">{props.title}</h1>
          </header>
          <div class="bg-surface px-5 py-4 sm:px-6 sm:py-5">{props.children}</div>
        </CardWrapper>
        <p class="mt-3 text-center text-2xs text-muted-foreground">{messageTranslate("app.tagline")}</p>
      </main>
    </PageWrapper>
  )
}
