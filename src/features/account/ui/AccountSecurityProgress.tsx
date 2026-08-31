import { accountSecurityProgressStateCreate } from "./accountSecurityProgressStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

export function AccountSecurityProgress(props: { readonly state: AccountSecurityViewState }) {
  const state = accountSecurityProgressStateCreate({
    methods: props.state.methods,
    passkeyCount: () => props.state.passkeys().length,
    user: props.state.user,
  })
  return (
    <section class="min-w-0 px-1 pt-1" data-account-security-progress>
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p class="shrink-0 text-sm font-medium text-foreground">{state.text()}</p>
        <div
          aria-label={state.accessibleLabel()}
          aria-valuemax={5}
          aria-valuemin={0}
          aria-valuenow={state.configuredCount()}
          class="h-2 w-full min-w-0 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-line-subtle sm:flex-1"
          role="progressbar"
        >
          <div
            aria-hidden="true"
            class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: state.width() }}
          />
        </div>
      </div>
    </section>
  )
}
