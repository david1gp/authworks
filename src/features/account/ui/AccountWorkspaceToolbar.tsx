import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedThemeToggle } from "../../../ui/authenticated/AuthenticatedThemeToggle.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"

/** Free-form language/theme/sign-out controls shown inline with the profile header. */
export function AccountWorkspaceToolbar(props: {
  readonly administrationHref?: string | undefined
  readonly userLabel?: string
}) {
  return (
    <div class="flex shrink-0 flex-wrap items-center gap-2" data-account-toolbar>
      <Show when={props.administrationHref}>
        {(href) => (
          <A class="rounded-control px-2 py-1 text-sm text-accent hover:bg-surface-hover" href={href()}>
            {messageTranslate("admin.navigation.label")}
          </A>
        )}
      </Show>
      {/* The source contract's <LanguageSelector /> now carries the authenticated pill class. */}
      <LanguageSelector class="authenticated-language-selector" />
      <AuthenticatedThemeToggle class="hidden sm:inline-flex" />
      <div class="flex items-center sm:hidden">
        <ThemeButton />
      </div>
      <div class="border-l border-line-subtle pl-1.5 sm:pl-2">
        <A
          aria-label={messageTranslate("common.signOut")}
          class="grid size-7 shrink-0 place-items-center rounded-control text-accent transition-colors hover:bg-surface-hover hover:text-accent-hover"
          href="/login/logout"
          title={messageTranslate("common.signOut")}
        >
          <Icon path={mdiLogout} />
        </A>
      </div>
    </div>
  )
}
