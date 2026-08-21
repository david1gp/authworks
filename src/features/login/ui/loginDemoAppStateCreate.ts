import { useLocation } from "@solidjs/router"
import { loginDemoBasePath, loginDemoStateCreate } from "./loginDemoStateCreate.js"

export function loginDemoAppStateCreate() {
  const location = useLocation()
  return {
    demo: loginDemoStateCreate(),
    isDirectory: () => location.pathname.replace(/\/+$/, "") === loginDemoBasePath,
  }
}
