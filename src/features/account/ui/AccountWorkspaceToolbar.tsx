import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { ThemeButton } from "#ui/interactive/theme/ThemeButton.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { LanguageSelector } from "../../../ui/i18n/ui/LanguageSelector.js"

/** Free-form language/theme/sign-out controls shown inline with the profile header. */
export function AccountWorkspaceToolbar(props: { readonly userLabel?: string }) {
  const initial = () => props.userLabel?.trim().slice(0, 1).toUpperCase() ?? ""
  return (
    <div class="flex shrink-0 items-center gap-1 sm:gap-2" data-account-toolbar>
      <LanguageSelector />
      <ThemeButton />
      <div class="flex shrink-0 items-center gap-1.5 border-l border-line-subtle pl-1.5 sm:gap-2 sm:pl-2">
        <Show when={initial()}>
          {(letter) => (
            <span
              aria-hidden="true"
              class="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent"
            >
              {letter()}
            </span>
          )}
        </Show>
        <A
          aria-label={messageTranslate("common.signOut")}
          class="grid size-7 shrink-0 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          href="/login/logout"
          title={messageTranslate("common.signOut")}
        >
          <Icon path={mdiLogout} />
        </A>
      </div>
    </div>
  )
}
