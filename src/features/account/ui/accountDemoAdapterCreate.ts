import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"

const demoMutationTimestamp = accountDemoUserFixture.updatedAt + 60_000
const demoPhoneChallenge = {
  accepted: true as const,
  challengeId: "account-demo-phone-change",
  expiresAt: 1_800_000_300_000,
  retryAt: 1_800_000_060_000,
}

export function accountDemoAdapterCreate(fixtureState: () => DemoFixtureState) {
  let fixtureUser = structuredClone(accountDemoUserFixture)
  const error = () =>
    resultErrorCodedCreate(
      "accountDemoFixture",
      "The deterministic account fixture is unavailable.",
      "platform.internal",
    )

  return {
    deleteAccount: async () => {
      if (fixtureState() === "error") return error()
      fixtureUser = { ...fixtureUser, deletedAt: demoMutationTimestamp, state: "deleted" }
      return resultCreate({ user: fixtureUser })
    },
    loadUser: async () => {
      if (fixtureState() === "error") return error()
      return resultCreate({ user: fixtureUser })
    },
    phoneChangeResend: async (_input: { readonly challengeId: string; readonly phoneNumber: string }) =>
      fixtureState() === "error" ? error() : resultCreate(demoPhoneChallenge),
    phoneChangeStart: async (_input: { readonly phoneNumber: string }) =>
      fixtureState() === "error" ? error() : resultCreate(demoPhoneChallenge),
    phoneChangeVerify: async (input: { readonly phoneNumber: string }) => {
      if (fixtureState() === "error") return error()
      fixtureUser = {
        ...fixtureUser,
        phoneNumber: input.phoneNumber,
        phoneNumberVerifiedAt: demoMutationTimestamp,
        updatedAt: demoMutationTimestamp,
      }
      return resultCreate({ user: fixtureUser })
    },
    updatePassword: async () => (fixtureState() === "error" ? error() : resultCreate({ changed: true as const })),
    updateProfile: async (input: UserProfileUpdateRequest) => {
      if (fixtureState() === "error") return error()
      fixtureUser = {
        ...fixtureUser,
        profile: {
          ...fixtureUser.profile,
          ...Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== null)),
        },
        updatedAt: demoMutationTimestamp,
      }
      return resultCreate({ user: fixtureUser })
    },
  }
}
