import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import type { PasskeyAuthenticationStatus } from "../../passkeys/public/passkeyAuthenticationStatusSchema.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import type { LoginDiscovery } from "./loginAdapter.js"
import type { LoginViewStatus } from "./loginViewStatusSchema.js"

type LoginDemoInitialState = {
  readonly discovery: LoginDiscovery | undefined
  readonly passkeyStatus?: PasskeyAuthenticationStatus
  readonly status: LoginViewStatus | undefined
}

export function loginDemoInitialStateResolve(
  screen: LoginScreen | undefined,
  fixtureState: DemoFixtureState,
): LoginDemoInitialState {
  if (fixtureState === "continuing") return { discovery: undefined, status: "continuing" }
  if (fixtureState === "fatal" || fixtureState === "loading" || screen === "loading")
    return { discovery: undefined, status: undefined }
  const passkeyStatus =
    fixtureState === "passkey-unsupported"
      ? "unsupported"
      : fixtureState === "passkey-permission-denied"
        ? "permission-denied"
        : fixtureState === "passkey-ceremony-failure"
          ? "ceremony-failure"
          : fixtureState === "passkey-pending"
            ? "pending"
            : undefined
  return {
    discovery: demoLoginBootstrap,
    ...(passkeyStatus === undefined ? {} : { passkeyStatus }),
    status: "ready",
  }
}
