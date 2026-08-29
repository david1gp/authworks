import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { authenticatedNavigationLinkClassGet } from "../../../ui/authenticated/authenticatedNavigationLinkClassGet.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { accountSectionNavStateCreate } from "./accountSectionNavStateCreate.js"

export function AccountSectionNav() {
  const state = accountSectionNavStateCreate()

  return (
    <nav
      aria-label={messageTranslate("shell.nav.navigationTitle", { title: messageTranslate("shell.nav.account") })}
      class="sticky top-12 z-20 flex items-center gap-1.5 overflow-x-auto border-b border-line bg-surface/95 px-4 py-2 backdrop-blur-sm sm:px-6"
    >
      <For each={state.items()}>
        {(item) => (
          <a
            aria-current={state.isActive(item.id) ? "location" : undefined}
            class={`${authenticatedNavigationLinkClassGet(state.isActive(item.id))} shrink-0 gap-1.5 px-2.5 py-1 text-xs`}
            href={item.href}
          >
            <Icon path={item.icon} />
            <span>{messageTranslate(item.label)}</span>
          </a>
        )}
      </For>
    </nav>
  )
}
