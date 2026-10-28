import { localReturnPathSelect } from "../../../platform/urls/localReturnPathSelect.js"

export function loginReturnPathSelect(returnPath: string | null | undefined, fallback: string): string {
  return localReturnPathSelect(returnPath, fallback)
}
