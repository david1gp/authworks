import { onMount } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasswordMeChangeResponse } from "../../passwords/public/passwordMeChangeResponseSchema.js"
import type { UserEmailChangeResendRequest } from "../../users/public/userEmailChangeResendRequestSchema.js"
import type { UserEmailChangeResendResponse } from "../../users/public/userEmailChangeResendResponseSchema.js"
import type { UserEmailChangeStartResponse } from "../../users/public/userEmailChangeStartResponseSchema.js"
import type { UserEmailChangeVerifyRequest } from "../../users/public/userEmailChangeVerifyRequestSchema.js"
import { userEmailChangeStartRequestSchema } from "../../users/public/userEmailChangeStartRequestSchema.js"
import { userEmailChangeVerifyRequestSchema } from "../../users/public/userEmailChangeVerifyRequestSchema.js"
import {
  type UserProfileUpdateRequest,
  userProfileUpdateRequestSchema,
} from "../../users/public/userProfileUpdateRequestSchema.js"
import type { UserResponse } from "../../users/public/userResponseSchema.js"
import type { User } from "../../users/public/userSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import type { WhatsappOtpPhoneChangeStartResponse } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartResponseSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"

type AccountPageAdapter = {
  readonly deleteAccount: () => Promise<Result<UserResponse>>
  readonly emailChangeResend: (input: UserEmailChangeResendRequest) => Promise<Result<UserEmailChangeResendResponse>>
  readonly emailChangeStart: (input: { email: string }) => Promise<Result<UserEmailChangeStartResponse>>
  readonly emailChangeVerify: (input: UserEmailChangeVerifyRequest) => Promise<Result<UserResponse>>
  readonly loadUser: () => Promise<Result<UserResponse>>
  readonly phoneChangeResend: (input: {
    challengeId: string
    phoneNumber: string
  }) => Promise<Result<WhatsappOtpPhoneChangeStartResponse>>
  readonly phoneChangeStart: (input: { phoneNumber: string }) => Promise<Result<WhatsappOtpPhoneChangeStartResponse>>
  readonly phoneChangeVerify: (input: {
    challengeId: string
    code: string
    phoneNumber: string
  }) => Promise<Result<UserResponse>>
  readonly updatePassword: (input: {
    currentPassword: string
    newPassword: string
  }) => Promise<Result<PasswordMeChangeResponse>>
  readonly updateProfile: (input: UserProfileUpdateRequest) => Promise<Result<UserResponse>>
}

export function accountPageStateCreate(options: {
  readonly adapter: AccountPageAdapter
  readonly initialStatus?: AccountViewStatus
  readonly kind: "delete" | "email" | "overview" | "password" | "profile"
}) {
  const status = createSignalObject<AccountViewStatus>(options.initialStatus ?? "loading")
  const user = createSignalObject<User | undefined>(undefined)
  const errorMessage = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const displayName = createSignalObject("")
  const firstName = createSignalObject("")
  const gender = createSignalObject("")
  const lastName = createSignalObject("")
  const nickName = createSignalObject("")
  const pictureContentType = createSignalObject("")
  const pictureUrl = createSignalObject("")
  const preferredLanguage = createSignalObject("")
  const currentPassword = createSignalObject("")
  const newPassword = createSignalObject("")
  const confirmPassword = createSignalObject("")
  const deletionConfirmation = createSignalObject("")
  const phoneCandidate = createSignalObject("")
  const phoneChallengeId = createSignalObject<string | undefined>(undefined)
  const phoneCode = createSignalObject("")
  const phoneErrorMessage = createSignalObject<string | undefined>(undefined)
  const phoneStatus = createSignalObject<AccountPhoneViewStatus>("idle")
  const phoneValidationMessage = createSignalObject<string | undefined>(undefined)
  const emailCandidate = createSignalObject("")
  const emailChallengeId = createSignalObject<string | undefined>(undefined)
  const emailToken = createSignalObject("")
  const emailErrorMessage = createSignalObject<string | undefined>(undefined)
  const emailStatus = createSignalObject<AccountEmailViewStatus>("idle")
  const emailValidationMessage = createSignalObject<string | undefined>(undefined)

  const resultIsExpired = (result: {
    readonly code?: string
    readonly errorMessage: string
    readonly statusCode?: number
  }) =>
    result.statusCode === 401 ||
    result.code === "sessions.unauthorized" ||
    /session|authenticated|unauthorized/i.test(result.errorMessage)
  const resultFail = (result: {
    readonly code?: string
    readonly errorMessage: string
    readonly statusCode?: number
  }) => {
    errorMessage.set(result.errorMessage)
    status.set(resultIsExpired(result) ? "expired" : "error")
  }
  const userApply = (nextUser: User) => {
    user.set(nextUser)
    displayName.set(nextUser.profile.displayName ?? "")
    firstName.set(nextUser.profile.firstName ?? "")
    gender.set(nextUser.profile.gender ?? "")
    lastName.set(nextUser.profile.lastName ?? "")
    nickName.set(nextUser.profile.nickName ?? "")
    pictureContentType.set(nextUser.profile.picture?.contentType ?? "")
    pictureUrl.set(nextUser.profile.picture?.url ?? "")
    preferredLanguage.set(nextUser.profile.preferredLanguage ?? "")
  }
  const pictureRemove = () => {
    pictureContentType.set("")
    pictureUrl.set("")
  }
  const load = async (force = false) => {
    if (options.initialStatus === "loading" && !force) return
    status.set("loading")
    errorMessage.set(undefined)
    const result = await options.adapter.loadUser()
    if (!result.success) return resultFail(result)
    userApply(result.data.user)
    phoneCandidate.set("")
    phoneChallengeId.set(undefined)
    phoneCode.set("")
    phoneErrorMessage.set(undefined)
    phoneValidationMessage.set(undefined)
    phoneStatus.set("idle")
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailErrorMessage.set(undefined)
    emailValidationMessage.set(undefined)
    emailStatus.set("idle")
    status.set("ready")
  }
  const profileSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    validationMessage.set(undefined)
    if (displayName.get().trim().length === 0) {
      validationMessage.set(messageTranslate("account.profile.displayNameRequired"))
      return
    }
    const picture = pictureUrl.get().trim()
    const profileInput = {
      displayName: displayName.get().trim(),
      firstName: firstName.get().trim() || null,
      gender: gender.get().trim() || null,
      lastName: lastName.get().trim() || null,
      nickName: nickName.get().trim() || null,
      picture:
        picture.length === 0
          ? null
          : {
              ...(pictureContentType.get().trim().length === 0 ? {} : { contentType: pictureContentType.get().trim() }),
              url: picture,
            },
      preferredLanguage: preferredLanguage.get().trim() || null,
    }
    const parsed = v.safeParse(userProfileUpdateRequestSchema, profileInput)
    if (!parsed.success) {
      const pictureIsInvalid = parsed.issues.some((issue) => issue.path?.[0]?.key === "picture")
      if (pictureIsInvalid) {
        validationMessage.set(messageTranslate("account.profile.pictureInvalid"))
        return
      }
    }
    status.set("loading")
    const result = await options.adapter.updateProfile(profileInput)
    if (!result.success) return resultFail(result)
    userApply(result.data.user)
    status.set("success")
  }
  const passwordSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    validationMessage.set(undefined)
    if (newPassword.get().length < 8) {
      validationMessage.set(messageTranslate("account.password.tooShort"))
      return
    }
    if (newPassword.get() !== confirmPassword.get()) {
      validationMessage.set(messageTranslate("account.password.mismatch"))
      return
    }
    status.set("loading")
    const result = await options.adapter.updatePassword({
      currentPassword: currentPassword.get(),
      newPassword: newPassword.get(),
    })
    if (!result.success) return resultFail(result)
    currentPassword.set("")
    newPassword.set("")
    confirmPassword.set("")
    status.set("success")
  }
  const accountDelete = async (event: SubmitEvent) => {
    event.preventDefault()
    validationMessage.set(undefined)
    if (deletionConfirmation.get() !== user.get()?.email) {
      validationMessage.set(messageTranslate("account.delete.emailMismatch"))
      return
    }
    status.set("loading")
    const result = await options.adapter.deleteAccount()
    if (!result.success) return resultFail(result)
    userApply(result.data.user)
    status.set("success")
  }
  const phoneOperationPrepare = () => {
    phoneErrorMessage.set(undefined)
    phoneValidationMessage.set(undefined)
  }
  const phoneChangeStart = async (event: SubmitEvent) => {
    event.preventDefault()
    phoneOperationPrepare()
    const parsed = v.safeParse(whatsappOtpPhoneChangeStartRequestSchema, {
      phoneNumber: phoneCandidate.get().trim(),
    })
    if (!parsed.success) {
      phoneValidationMessage.set(messageTranslate("account.profile.phoneInvalid"))
      return
    }
    phoneCandidate.set(parsed.output.phoneNumber)
    phoneStatus.set("sending")
    const result = await options.adapter.phoneChangeStart(parsed.output)
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      phoneErrorMessage.set(result.errorMessage)
      phoneStatus.set("error")
      return
    }
    phoneChallengeId.set(result.data.challengeId)
    phoneStatus.set("code")
  }
  const phoneChangeResend = async () => {
    const challengeId = phoneChallengeId.get()
    if (challengeId === undefined) return
    phoneOperationPrepare()
    phoneStatus.set("sending")
    const result = await options.adapter.phoneChangeResend({ challengeId, phoneNumber: phoneCandidate.get() })
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      phoneErrorMessage.set(result.errorMessage)
      phoneStatus.set("error")
      return
    }
    phoneChallengeId.set(result.data.challengeId)
    phoneStatus.set("code")
  }
  const phoneChangeVerify = async (event: SubmitEvent) => {
    event.preventDefault()
    phoneOperationPrepare()
    const parsed = v.safeParse(whatsappOtpPhoneChangeVerifyRequestSchema, {
      challengeId: phoneChallengeId.get(),
      code: phoneCode.get().trim(),
      phoneNumber: phoneCandidate.get(),
    })
    if (!parsed.success) {
      phoneValidationMessage.set(messageTranslate("account.profile.phoneCodeInvalid"))
      return
    }
    phoneStatus.set("verifying")
    const result = await options.adapter.phoneChangeVerify(parsed.output)
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      phoneErrorMessage.set(result.errorMessage)
      phoneStatus.set("error")
      return
    }
    userApply(result.data.user)
    phoneCandidate.set("")
    phoneChallengeId.set(undefined)
    phoneCode.set("")
    phoneStatus.set("success")
  }
  const phoneChangeCancel = () => {
    phoneChallengeId.set(undefined)
    phoneCode.set("")
    phoneOperationPrepare()
    phoneStatus.set("idle")
  }

  const emailOperationPrepare = () => {
    emailErrorMessage.set(undefined)
    emailValidationMessage.set(undefined)
  }
  const emailChangeStart = async (event: SubmitEvent) => {
    event.preventDefault()
    emailOperationPrepare()
    const parsed = v.safeParse(userEmailChangeStartRequestSchema, { email: emailCandidate.get().trim() })
    if (!parsed.success) {
      emailValidationMessage.set(messageTranslate("account.profile.emailInvalid"))
      return
    }
    emailCandidate.set(parsed.output.email)
    emailStatus.set("sending")
    const result = await options.adapter.emailChangeStart(parsed.output)
    if (!result.success) {
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailChallengeId.set(result.data.challengeId)
    emailStatus.set("code")
  }
  const emailChangeResend = async () => {
    const challengeId = emailChallengeId.get()
    if (challengeId === undefined) return
    emailOperationPrepare()
    emailStatus.set("sending")
    const result = await options.adapter.emailChangeResend({ challengeId, email: emailCandidate.get() })
    if (!result.success) {
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailChallengeId.set(result.data.challengeId)
    emailStatus.set("code")
  }
  const emailChangeVerify = async (event: SubmitEvent) => {
    event.preventDefault()
    emailOperationPrepare()
    const parsed = v.safeParse(userEmailChangeVerifyRequestSchema, {
      challengeId: emailChallengeId.get(),
      token: emailToken.get().trim(),
    })
    if (!parsed.success) {
      emailValidationMessage.set(messageTranslate("account.profile.emailTokenInvalid"))
      return
    }
    emailStatus.set("verifying")
    const result = await options.adapter.emailChangeVerify(parsed.output)
    if (!result.success) {
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    userApply(result.data.user)
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailStatus.set("success")
  }
  const emailChangeCancel = () => {
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailOperationPrepare()
    emailStatus.set("idle")
  }

  onMount(() => {
    void (async () => {
      await load()
      if (typeof window === "undefined") return
      const query = new URLSearchParams(window.location.search)
      const token = query.get("token")
      const challengeId = query.get("challengeId")
      if (token === null || challengeId === null) return
      const parsed = v.safeParse(userEmailChangeVerifyRequestSchema, { challengeId, token })
      if (!parsed.success) return
      emailChallengeId.set(parsed.output.challengeId)
      emailToken.set(parsed.output.token)
      emailStatus.set("code")
      query.delete("challengeId")
      query.delete("token")
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${query}${window.location.hash}`,
      )
    })()
  })
  return {
    accountDelete,
    confirmPassword,
    currentPassword,
    deletionConfirmation,
    displayName,
    emailCandidate,
    emailChallengeId,
    emailChangeCancel,
    emailChangeResend,
    emailChangeStart,
    emailChangeVerify,
    emailErrorMessage,
    emailStatus,
    emailToken,
    emailValidationMessage,
    errorMessage,
    firstName,
    gender,
    lastName,
    load,
    newPassword,
    nickName,
    passwordSubmit,
    phoneCandidate,
    phoneChallengeId,
    phoneChangeCancel,
    phoneChangeResend,
    phoneChangeStart,
    phoneChangeVerify,
    phoneCode,
    phoneErrorMessage,
    phoneStatus,
    phoneValidationMessage,
    pictureContentType,
    pictureRemove,
    pictureUrl,
    preferredLanguage,
    profileSubmit,
    status,
    user,
    validationMessage,
  }
}
