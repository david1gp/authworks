import { For } from "solid-js"
import { Icon } from "#ui/static/icon/Icon.jsx"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"
import { accountSecurityOverviewStateCreate } from "./accountSecurityOverviewStateCreate.js"

export function AccountSecurityOverview(props: { readonly state: AccountSecurityViewState }) {
  const state = accountSecurityOverviewStateCreate({ methods: props.state.methods, user: props.state.user })
  return (
    <div
      class="grid overflow-hidden rounded-lg border border-line-subtle bg-surface sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      data-account-security-overview
    >
      <For each={state.items()}>
        {(item) => (
          <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-line-subtle p-3 not-last:border-b sm:not-last:border-r lg:not-last:border-b-0">
            <Icon
              aria-hidden="true"
              class={item.configured ? "mt-0.5 size-5 text-success" : "mt-0.5 size-5 text-danger"}
              path={item.icon}
            />
            <dl class="grid min-w-0 gap-0.5">
              <dt class="text-xs font-semibold text-muted-foreground">{item.label}</dt>
              <dd class="truncate text-sm font-medium" title={item.detail}>
                {item.detail}
              </dd>
            </dl>
          </div>
        )}
      </For>
    </div>
  )
}
