import type { JSX } from "solid-js"
import { For, Show } from "solid-js"
import { LinkTextExternal } from "#ui/interactive/link/LinkText.jsx"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
import { PageWrapper } from "#ui/static/page/PageWrapper.jsx"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { BrandHeader } from "./BrandHeader.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { loginFrameStateCreate } from "./loginFrameStateCreate.js"
import { loginLegalSegmentsGet } from "./loginLegalSegmentsGet.js"

type LoginFrameProps = {
  readonly bootstrap: LoginDiscovery
  readonly children: JSX.Element
}

export function LoginFrame(props: LoginFrameProps) {
  const state = loginFrameStateCreate(() => props.bootstrap)
  return (
    <PageWrapper innerClass="relative flex min-h-dvh items-center justify-center p-4 py-10 sm:p-6 sm:py-12">
      <header class="absolute right-3 top-3 flex items-center gap-2 sm:right-4 sm:top-4">
        <LanguageSelector />
        <ThemeButton />
      </header>
      <main class="w-full max-w-lg">
        <CardWrapper
          class="p-5 sm:p-10"
          style={{ "--login-primary": state.theme().primaryColor, "--login-background": state.theme().backgroundColor }}
        >
          <BrandHeader name={state.bootstrap().organization.name} logoUrl={state.theme().logoUrl} />
          {props.children}
        </CardWrapper>
        <Show when={state.legal()?.termsUrl ?? state.legal()?.privacyUrl}>
          <p class="mt-5 bg-slate-100 text-pretty text-center text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <For each={loginLegalSegmentsGet()}>
              {(segment) =>
                segment.kind === "text" ? (
                  segment.value
                ) : (
                  <LegalLink
                    href={segment.kind === "terms" ? state.legal()?.termsUrl : state.legal()?.privacyUrl}
                    label={segment.value}
                  />
                )
              }
            </For>
          </p>
        </Show>
      </main>
    </PageWrapper>
  )
}

/** Legal links stay underlined so they are distinguishable without relying on colour alone. */
function LegalLink(props: { readonly href?: string; readonly label: string }) {
  return (
    <Show when={props.href} fallback={props.label}>
      {(href) => (
        <LinkTextExternal class="whitespace-nowrap underline" href={href()} target="_blank" rel="noreferrer">
          {props.label}
        </LinkTextExternal>
      )}
    </Show>
  )
}
