import { Show } from "solid-js"
import { DemoLoginDirectory } from "../../demo/ui/DemoLoginDirectory.js"
import { LoginDemoAdapter } from "./LoginDemoAdapter.js"
import { loginDemoAppStateCreate } from "./loginDemoAppStateCreate.js"

export function LoginDemoApp() {
  const state = loginDemoAppStateCreate()
  return (
    <Show when={!state.isDirectory()} fallback={<DemoLoginDirectory />}>
      <LoginDemoAdapter state={state.demo} />
    </Show>
  )
}
