import type { LoginPreference } from "../login/model/loginPreferenceSchema.js"

export const demoLoginPasswordPreference: LoginPreference = {
  email: "alex@acme.example",
  identifier: "alex@acme.example",
  rememberIdentifier: true,
  updatedAt: Date.UTC(2026, 7, 21, 9, 30),
  version: 1,
}
