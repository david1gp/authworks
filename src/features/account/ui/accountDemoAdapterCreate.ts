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
const demoEmailChallenge = {
  accepted: true as const,
  challengeId: "account-demo-email-change",
  expiresAt: 1_800_000_300_000,
  retryAt: 1_800_000_060_000,
}
const demoEmailTokenLength = 32

export function accountDemoAdapterCreate(fixtureState: () => DemoFixtureState) {
  let fixtureUser = structuredClone(accountDemoUserFixture)
  let emailChallenge: { consumed: boolean; email: string } | undefined
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
    emailChangeResend: async (input: { readonly challengeId: string; readonly email: string }) => {
      if (fixtureState() === "error") return error()
      if (
        emailChallenge === undefined ||
        emailChallenge.consumed ||
        input.challengeId !== demoEmailChallenge.challengeId ||
        input.email.toLowerCase() !== emailChallenge.email
      )
        return resultErrorCodedCreate(
          "accountDemoEmailChange",
          "The account email-change challenge is invalid.",
          "users.invalid",
        )
      return resultCreate(demoEmailChallenge)
    },
    emailChangeStart: async (input: { readonly email: string }) => {
      if (fixtureState() === "error") return error()
      if (input.email.toLowerCase() === fixtureUser.email.toLowerCase())
        return resultErrorCodedCreate(
          "accountDemoEmailChange",
          "The account already uses this email address.",
          "users.conflict",
        )
      emailChallenge = { consumed: false, email: input.email.toLowerCase() }
      return resultCreate(demoEmailChallenge)
    },
    emailChangeVerify: async (input: { readonly challengeId: string; readonly token: string }) => {
      if (fixtureState() === "error") return error()
      if (
        emailChallenge === undefined ||
        emailChallenge.consumed ||
        input.challengeId !== demoEmailChallenge.challengeId ||
        input.token.length < demoEmailTokenLength
      )
        return resultErrorCodedCreate(
          "accountDemoEmailChange",
          "The account email-change token is invalid.",
          "users.invalid",
        )
      if (emailChallenge.email === fixtureUser.email.toLowerCase())
        return resultErrorCodedCreate(
          "accountDemoEmailChange",
          "The account already uses this email address.",
          "users.conflict",
        )
      emailChallenge = { ...emailChallenge, consumed: true }
      fixtureUser = {
        ...fixtureUser,
        email: emailChallenge.email,
        emailVerified: true,
        emailVerifiedAt: demoMutationTimestamp,
        updatedAt: demoMutationTimestamp,
      }
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
      const profile = Object.fromEntries(
        Object.entries({ ...fixtureUser.profile, ...input }).filter(
          (entry) => entry[1] !== null && entry[1] !== undefined,
        ),
      ) as typeof fixtureUser.profile
      fixtureUser = {
        ...fixtureUser,
        profile,
        updatedAt: demoMutationTimestamp,
      }
      return resultCreate({ user: fixtureUser })
    },
  }
}
