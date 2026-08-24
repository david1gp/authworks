import { Show } from "solid-js"
import { demoFixtureStateLabel } from "../../demo/public/demoFixtureStateLabel.js"
import { DemoFixtureStateSelector } from "../../demo/ui/DemoFixtureStateSelector.js"
import { LoginScreenView } from "./LoginScreenView.js"
import { loginDemoStates } from "./loginDemoStates.js"
import type { loginDemoStateCreate } from "./loginDemoStateCreate.js"

/** Fixture-state chooser plus the shared login view, so every demo state stays URL-selectable. */
export function LoginDemoAdapter(props: { readonly state: ReturnType<typeof loginDemoStateCreate> }) {
  return (
    <div class="login-demo-shell min-h-dvh bg-background">
      <Show when={props.state.page.screen() !== "unsupported"}>
        <div class="flex justify-center border-b border-line bg-surface/95 px-3 py-2">
          <DemoFixtureStateSelector
            options={loginDemoStates.map((fixtureState) => ({
              href: `${props.state.path()}?state=${fixtureState}`,
              label: demoFixtureStateLabel(fixtureState),
              selected: props.state.fixtureState() === fixtureState,
            }))}
          />
        </div>
      </Show>
      <LoginScreenView state={props.state.page} />
    </div>
  )
}
