import { AccountDemoScreen } from "./AccountDemoScreen.js"
import { accountDemoAppStateCreate } from "./accountDemoAppStateCreate.js"

export function AccountDemoApp() {
  const state = accountDemoAppStateCreate()
  return <AccountDemoScreen state={state} />
}
