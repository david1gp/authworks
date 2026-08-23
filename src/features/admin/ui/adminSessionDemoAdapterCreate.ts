import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { AdminAdapter } from "./adminAdapter.js"
import { adminDemoSessionFixture } from "./adminDemoSessionFixture.js"

/**
 * Deterministic administrator sign-in and session behavior for `/demo/admin/**`. No network,
 * backend, or stored credential is involved in any fixture state.
 */
export function adminSessionDemoAdapterCreate(options: {
  readonly fixtureState: () => DemoFixtureState
  /** Realm screens assume an established session; the sign-in screen deliberately starts without one. */
  readonly signedInInitially?: boolean
}): Pick<AdminAdapter, "adminSignIn" | "adminSignOut" | "sessionCurrent"> {
  const state = options.fixtureState
  // The demo starts without an administrator session so the sign-in form is reachable, exactly as
  // it is in production before the bootstrap exchange runs.
  let signedIn = false
  const pending = <T>() => new Promise<T>(() => undefined)
  const invalid = (op: string) =>
    resultErrorCodedCreate(op, "The bootstrap administrator credentials are invalid.", "sessions.unauthorized")
  const expired = (op: string) =>
    resultErrorCodedCreate(op, "The administrator session has expired.", "sessions.unauthorized")

  return {
    adminSignIn: async (secret) => {
      if (state() === "loading") return pending()
      if (state() === "error" || state() === "expired") return invalid("adminDemoSignIn")
      if (secret.length < 32) return invalid("adminDemoSignIn")
      signedIn = true
      return resultCreate(structuredClone(adminDemoSessionFixture))
    },
    adminSignOut: async () => {
      signedIn = false
      return resultCreate({ revoked: true })
    },
    sessionCurrent: async () => {
      if (state() === "loading") return pending()
      if (state() === "error")
        return resultErrorCodedCreate(
          "adminDemoSessionCurrent",
          "The deterministic administration fixture is unavailable.",
          "realms.read-failed",
        )
      if (state() === "expired") return expired("adminDemoSessionCurrent")
      if (!signedIn && options.signedInInitially !== true) return expired("adminDemoSessionCurrent")
      return resultCreate(structuredClone(adminDemoSessionFixture))
    },
  }
}
