import { loginDemoAppStateCreate } from "./loginDemoAppStateCreate.js"
import { LoginDemoScreen } from "./LoginDemoScreen.js"

export function LoginDemoApp() {
  const state = loginDemoAppStateCreate()
  return <LoginDemoScreen state={state} />
}
