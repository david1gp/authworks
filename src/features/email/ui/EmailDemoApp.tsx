import { EmailDemoScreen } from "./EmailDemoScreen.js"
import { emailDemoAppStateCreate } from "./emailDemoAppStateCreate.js"

export function EmailDemoApp() {
  const state = emailDemoAppStateCreate()
  return <EmailDemoScreen state={state} />
}
