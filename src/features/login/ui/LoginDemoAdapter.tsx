import { LoginScreenView } from "./LoginScreenView.js"
import type { loginDemoStateCreate } from "./loginDemoStateCreate.js"

/** Shared login view with fixture-backed state, so every demo state stays URL-selectable. */
export function LoginDemoAdapter(props: { readonly state: ReturnType<typeof loginDemoStateCreate> }) {
  return <LoginScreenView state={props.state.page} />
}
