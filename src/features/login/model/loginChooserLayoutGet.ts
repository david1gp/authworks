import type { LoginPrimaryMethod } from "./loginPrimaryMethodsGet.js"

export type LoginChooserLayout = "single" | "split"

/** The chooser splits into own-account methods and external providers only when both groups have entries. */
export function loginChooserLayoutGet(methods: readonly LoginPrimaryMethod[]): LoginChooserLayout {
  const hasProviders = methods.includes("external-identity")
  const hasOwnMethods = methods.some((method) => method !== "external-identity")
  if (!hasProviders || !hasOwnMethods) return "single"
  return "split"
}
