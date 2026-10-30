import { mdiAccountOutline } from "@adaptive-ds/mdi/mdiAccountOutline.js"
import { mdiChevronDown } from "@adaptive-ds/mdi/mdiChevronDown.js"
import { mdiLogout } from "@adaptive-ds/mdi/mdiLogout.js"
import Popover from "@corvu/popover"
import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedAvatar } from "../authenticated/AuthenticatedAvatar.js"
import { AuthenticatedThemeToggle } from "../authenticated/AuthenticatedThemeToggle.js"
import { authenticatedNavigationClasses } from "../authenticated/authenticatedNavigationClasses.js"
import { messageTranslate } from "../i18n/model/messageTranslate.js"
import { LanguageSelector } from "../i18n/ui/LanguageSelector.js"
import { productionIdentityMenuStateCreate } from "./productionIdentityMenuStateCreate.js"

/**
 * Sidebar user popover: a single avatar-plus-name button whose menu hosts the profile
 * destination together with the language and theme controls, so the rail footer needs no
 * separate preference rows. Surfaces without an account (such as the demo shell) omit the
 * profile and sign-out destinations and keep only the preference controls.
 */
export function ProductionIdentityMenu(props: {
  readonly name: string
  readonly pictureUrl?: string | undefined
  readonly showProfile: boolean
  readonly signOutHref?: string | undefined
  readonly onNavigate: () => void
}) {
  const state = productionIdentityMenuStateCreate({ onNavigate: () => props.onNavigate() })

  return (
    <Popover floatingOptions={{ flip: true, shift: true }} onOpenChange={state.openChange} open={state.open()}>
      <Popover.Trigger class={authenticatedNavigationClasses.identityTrigger} title={props.name}>
        <span aria-hidden="true">
          <AuthenticatedAvatar name={props.name} size="sm" src={props.pictureUrl} />
        </span>
        <span class={authenticatedNavigationClasses.identityName}>{props.name}</span>
        <Icon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground" path={mdiChevronDown} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class={authenticatedNavigationClasses.identityMenu} data-identity-menu="">
          <p class={authenticatedNavigationClasses.identityMenuHeader} title={props.name}>
            {props.name}
          </p>
          <div class="grid gap-0.5 p-1">
            <Show when={props.showProfile}>
              <A class={authenticatedNavigationClasses.identityMenuOption} href="/account" onClick={state.select}>
                <Icon aria-hidden="true" class="size-4 shrink-0" path={mdiAccountOutline} />
                <span class="min-w-0 flex-1 truncate">{messageTranslate("shell.nav.profile")}</span>
              </A>
            </Show>
            <div class={authenticatedNavigationClasses.identityMenuPreferences}>
              <p class={authenticatedNavigationClasses.identityMenuCaption}>{messageTranslate("common.language")}</p>
              <LanguageSelector class="w-full" />
              <AuthenticatedThemeToggle />
            </div>
            <Show when={props.signOutHref}>
              {(href) => (
                <A class={authenticatedNavigationClasses.identityMenuOption} href={href()} onClick={state.select}>
                  <Icon aria-hidden="true" class="size-4 shrink-0 rtl:-scale-x-100" path={mdiLogout} />
                  <span class="min-w-0 flex-1 truncate">{messageTranslate("common.signOut")}</span>
                </A>
              )}
            </Show>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
