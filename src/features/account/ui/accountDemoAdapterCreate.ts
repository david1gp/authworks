import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import { accountDemoUserFixture } from "./accountDemoUserFixture.js"

const demoMutationTimestamp = accountDemoUserFixture.updatedAt + 60_000
const demoPhoneChallenge = {
  accepted: true as const,
  challengeId: "account-demo-phone-change",
  expiresAt: 1_800_000_300_000,
  retryAt: 1_800_000_060_000,
}
const demoEmailAddressChallenge = {
  accepted: true as const,
  challengeId: "account-demo-email-address-add",
  expiresAt: 1_800_000_300_000,
  retryAt: 1_800_000_060_000,
}
const demoEmailAddressToken = "demo-email-address-token-000000000000000000000"
const demoPictureExtensions: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const demoEmailAddresses: UserEmailAddress[] = [
  {
    createdAt: accountDemoUserFixture.createdAt,
    email: accountDemoUserFixture.email,
    id: "account-demo-email-primary",
    isPrimary: true,
    updatedAt: accountDemoUserFixture.updatedAt,
    verified: true,
    verifiedAt: accountDemoUserFixture.emailVerifiedAt ?? null,
    version: 1,
  },
  {
    createdAt: accountDemoUserFixture.createdAt + 30_000,
    email: "avery.secondary@example.com",
    id: "account-demo-email-secondary",
    isPrimary: false,
    updatedAt: accountDemoUserFixture.updatedAt,
    verified: true,
    verifiedAt: accountDemoUserFixture.emailVerifiedAt ?? null,
    version: 1,
  },
]

export function accountDemoAdapterCreate(fixtureState: () => DemoFixtureState) {
  let fixtureUser = structuredClone(accountDemoUserFixture)
  let emailChallenge: { consumed: boolean; email: string } | undefined
  let emailAddresses = structuredClone(demoEmailAddresses)
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
    emailAddressAddDemoToken: demoEmailAddressToken,
    emailAddressAddResend: async (input: { readonly challengeId: string; readonly email: string }) => {
      if (fixtureState() === "error") return error()
      if (
        emailChallenge === undefined ||
        emailChallenge.consumed ||
        input.challengeId !== demoEmailAddressChallenge.challengeId ||
        input.email.toLowerCase() !== emailChallenge.email
      )
        return resultErrorCodedCreate(
          "accountDemoEmailAddressAdd",
          "The account email-address challenge is invalid.",
          "users.invalid",
        )
      return resultCreate(demoEmailAddressChallenge)
    },
    emailAddressAddStart: async (input: { readonly email: string }) => {
      if (fixtureState() === "error") return error()
      if (emailAddresses.some((address) => address.email.toLowerCase() === input.email.toLowerCase()))
        return resultErrorCodedCreate(
          "accountDemoEmailAddressAdd",
          "The account already has this email address.",
          "users.conflict",
        )
      emailChallenge = { consumed: false, email: input.email.toLowerCase() }
      return resultCreate(demoEmailAddressChallenge)
    },
    emailAddressAddVerify: async (input: { readonly challengeId: string; readonly token: string }) => {
      if (fixtureState() === "error") return error()
      if (
        emailChallenge === undefined ||
        emailChallenge.consumed ||
        input.challengeId !== demoEmailAddressChallenge.challengeId ||
        input.token !== demoEmailAddressToken
      )
        return resultErrorCodedCreate(
          "accountDemoEmailAddressAdd",
          "The account email-address token is invalid.",
          "users.invalid",
        )
      if (emailAddresses.some((address) => address.email.toLowerCase() === emailChallenge?.email))
        return resultErrorCodedCreate(
          "accountDemoEmailAddressAdd",
          "The account already has this email address.",
          "users.conflict",
        )
      emailChallenge = { ...emailChallenge, consumed: true }
      const email: UserEmailAddress = {
        createdAt: demoMutationTimestamp,
        email: emailChallenge.email,
        id: `account-demo-email-${emailAddresses.length + 1}`,
        isPrimary: false,
        updatedAt: demoMutationTimestamp,
        verified: true,
        verifiedAt: demoMutationTimestamp,
        version: 1,
      }
      emailAddresses = [...emailAddresses, email]
      return resultCreate({ email })
    },
    emailAddressList: async () =>
      fixtureState() === "error" ? error() : resultCreate({ items: structuredClone(emailAddresses) }),
    emailAddressPrimarySet: async (emailId: string) => {
      if (fixtureState() === "error") return error()
      const email = emailAddresses.find((address) => address.id === emailId)
      if (email === undefined || !email.verified || email.isPrimary)
        return resultErrorCodedCreate(
          "accountDemoEmailAddressPrimarySet",
          "Only a verified secondary email address can become primary.",
          "users.invalid",
        )
      emailAddresses = emailAddresses.map((address) => ({ ...address, isPrimary: address.id === emailId }))
      const primary = emailAddresses.find((address) => address.id === emailId) as UserEmailAddress
      fixtureUser = {
        ...fixtureUser,
        email: primary.email,
        emailVerified: primary.verified,
        emailVerifiedAt: primary.verifiedAt ?? undefined,
        updatedAt: demoMutationTimestamp,
      }
      return resultCreate({ email: primary })
    },
    emailAddressRemove: async (emailId: string) => {
      if (fixtureState() === "error") return error()
      const email = emailAddresses.find((address) => address.id === emailId)
      if (email === undefined || email.isPrimary)
        return resultErrorCodedCreate(
          "accountDemoEmailAddressRemove",
          "The primary email address cannot be removed.",
          "users.invalid",
        )
      emailAddresses = emailAddresses.filter((address) => address.id !== emailId)
      return resultCreate({ removed: true as const })
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
    profilePictureRemove: async () => {
      if (fixtureState() === "error") return error()
      const { picture: _removed, ...profile } = fixtureUser.profile
      fixtureUser = { ...fixtureUser, profile, updatedAt: demoMutationTimestamp }
      return resultCreate({ user: fixtureUser })
    },
    profilePictureUpload: async (file: Blob) => {
      if (fixtureState() === "error") return error()
      // The fixture mirrors the immutable hosted key shape without performing any network call.
      fixtureUser = {
        ...fixtureUser,
        profile: {
          ...fixtureUser.profile,
          picture: {
            contentType: file.type,
            url: `https://assets.example.com/user-pictures/${fixtureUser.userName}_demo.${demoPictureExtensions[file.type] ?? "png"}`,
          },
        },
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
