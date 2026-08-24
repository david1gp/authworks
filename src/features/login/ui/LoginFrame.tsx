import type { JSX } from "solid-js"
import { For, Show } from "solid-js"
import { LinkTextExternal } from "#ui/interactive/link/LinkText.jsx"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import { BrandHeader } from "./BrandHeader.js"
import { LoginThemeToggle } from "./LoginThemeToggle.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import { loginBackgroundNameGet } from "./loginBackgroundNameGet.js"
import { loginFrameStateCreate } from "./loginFrameStateCreate.js"
import { loginLegalSegmentsGet } from "./loginLegalSegmentsGet.js"

type LoginFrameProps = {
  readonly bootstrap: LoginDiscovery
  readonly busy: boolean
  readonly children: JSX.Element
  readonly screen: LoginScreen
}

export function LoginFrame(props: LoginFrameProps) {
  const state = loginFrameStateCreate(
    () => props.bootstrap,
    () => props.screen,
  )
  return (
    <div
      class="login-page-shell"
      data-login-background={loginBackgroundNameGet(props.screen)}
      data-theme={state.effectiveTheme()}
      style={{
        "--brand-background": state.theme().backgroundColor,
        "--brand-font": state.theme().fontColor,
        "--brand-primary": state.theme().primaryColor,
        "--brand-warn": state.theme().warnColor,
        "--login-background": state.theme().backgroundColor,
        "--login-primary": state.theme().primaryColor,
      }}
    >
      <main class="login-frame">
        <header class="login-controls">
          <LanguageSelector class="login-language-selector" />
          <LoginThemeToggle disabled={!state.themeSwitchable()} options={state.themeOptions} />
        </header>
        <section aria-busy={props.busy} class="login-card">
          <BrandHeader
            name={state.bootstrap().organization.name}
            logoUrl={state.assetUrl()}
            onLogoError={state.assetFail}
          />
          <div class="login-card-content" ref={state.contentRegister}>
            {props.children}
          </div>
        </section>
        <Show when={state.legal()}>
          {(legal) => (
            <p class="login-legal">
              <For each={loginLegalSegmentsGet()}>
                {(segment) =>
                  segment.kind === "text" ? (
                    segment.value
                  ) : (
                    <LegalLink
                      href={segment.kind === "terms" ? legal().termsUrl : legal().privacyUrl}
                      label={segment.value}
                    />
                  )
                }
              </For>
            </p>
          )}
        </Show>
      </main>
    </div>
  )
}

/** Legal links stay underlined so they are distinguishable without relying on colour alone. */
function LegalLink(props: { readonly href: string; readonly label: string }) {
  return (
    <LinkTextExternal
      class="whitespace-nowrap underline underline-offset-3"
      href={props.href}
      target="_blank"
      rel="noreferrer"
    >
      {props.label}
    </LinkTextExternal>
  )
}
