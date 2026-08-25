import type { JSX } from "solid-js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"
import { LoginThemeToggle } from "./LoginThemeToggle.js"
import { loginBackgroundNameGet } from "./loginBackgroundNameGet.js"
import { loginUnavailableFrameStateCreate } from "./loginUnavailableFrameStateCreate.js"

/** Login shell used before or instead of realm discovery, when no branding is available yet. */
export function LoginUnavailableFrame(props: {
  readonly busy?: boolean
  readonly children: JSX.Element
  readonly unavailable?: boolean
}) {
  const state = loginUnavailableFrameStateCreate()
  return (
    <div
      class="login-page-shell login-page-shell-fallback"
      data-login-background={loginBackgroundNameGet(props.unavailable ? "unsupported" : "loading")}
      data-theme={state.effectiveTheme()}
      style={{
        "--brand-background": state.theme().backgroundColor,
        "--brand-font": state.theme().fontColor,
        "--brand-primary": state.theme().primaryColor,
        "--brand-warn": state.theme().warnColor,
      }}
    >
      <main class="login-frame">
        <section aria-busy={props.busy} class="login-card p-5 sm:p-10">
          {props.children}
        </section>
        <header class="login-controls">
          <LanguageSelector class="login-language-selector" />
          <LoginThemeToggle disabled={false} options={state.themeOptions} />
        </header>
      </main>
    </div>
  )
}
