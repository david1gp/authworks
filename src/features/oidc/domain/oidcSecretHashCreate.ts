import { oidcHashCreate } from "./oidcHashCreate.js"

export function oidcSecretHashCreate(value: string): string {
  return oidcHashCreate(value)
}
