import { LoginScreenView } from "./LoginScreenView.js"
import { loginProductionStateCreate } from "./loginProductionStateCreate.js"

export function LoginProductionAdapter() {
  return <LoginScreenView state={loginProductionStateCreate()} />
}
