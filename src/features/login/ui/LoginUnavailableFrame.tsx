import type { JSX } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"

/** Login shell used before or instead of realm discovery, when no branding is available yet. */
export function LoginUnavailableFrame(props: { readonly children: JSX.Element }) {
  return (
    <PageWrapper innerClass="relative flex min-h-dvh items-center justify-center p-4 py-10 sm:p-6 sm:py-12">
      <div class="absolute right-3 top-3 flex items-center gap-2 sm:right-4 sm:top-4">
        <LanguageSelector />
        <ThemeButton />
      </div>
      <main class="w-full max-w-lg">
        <CardWrapper class="p-5 sm:p-10">{props.children}</CardWrapper>
      </main>
    </PageWrapper>
  )
}
