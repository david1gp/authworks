import { LoginScreenView } from "./LoginScreenView.js"
import { loginProductionStateCreate } from "./loginProductionStateCreate.js"

export function LoginProductionAdapter() {
  const state = loginProductionStateCreate()
  return <LoginScreenView state={state} />
}
