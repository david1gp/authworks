import type { JSX } from "solid-js"
import { AuthenticatedBrandMark } from "../authenticated/AuthenticatedBrandMark.js"
import { AuthenticatedThemeToggle } from "../authenticated/AuthenticatedThemeToggle.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { productionFocusShellStateCreate } from "./productionFocusShellStateCreate.js"

export function ProductionFocusShell(props: { readonly children: JSX.Element; readonly title: string }) {
  const state = productionFocusShellStateCreate()
  return (
    <div class="authenticated-focus-canvas relative flex min-h-dvh items-center justify-center px-3 py-20 text-foreground sm:px-6">
      <header class="absolute end-4 top-4 flex items-center gap-2">
        <LanguageSelector class="authenticated-language-selector" />
        <AuthenticatedThemeToggle />
      </header>
      <main class="w-full max-w-[470px]" data-shell="focus">
        <div class="overflow-hidden rounded-[18px] border border-line bg-surface shadow-overlay">
          <header class="px-6 pt-6 sm:px-7">
            <div class="flex items-center gap-2.5 border-b border-line-subtle pb-5">
              <AuthenticatedBrandMark />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{messageTranslate("app.name")}</p>
                <p class="truncate text-xs text-muted-foreground">{state.realmLabel()}</p>
              </div>
            </div>
            <h1 class="pt-6 text-xl font-semibold tracking-tight sm:text-2xl">{props.title}</h1>
          </header>
          <div class="px-6 py-6 sm:px-7">{props.children}</div>
        </div>
        <p class="mt-3 text-center text-2xs text-muted-foreground">{messageTranslate("app.tagline")}</p>
      </main>
    </div>
  )
}
