import { onMount } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasswordMeChangeResponse } from "../../passwords/public/passwordMeChangeResponseSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import type { UserResponse } from "../../users/public/userResponseSchema.js"
import type { User } from "../../users/public/userSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import type { WhatsappOtpPhoneChangeStartResponse } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartResponseSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"

type AccountPageAdapter = {
  readonly deleteAccount: () => Promise<Result<UserResponse>>
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
  const lastName = createSignalObject("")
  const nickName = createSignalObject("")
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

  const resultFail = (result: { readonly errorMessage: string }) => {
    errorMessage.set(result.errorMessage)
    status.set(/session|authenticated|unauthorized/i.test(result.errorMessage) ? "expired" : "error")
  }
  const userApply = (nextUser: User) => {
    user.set(nextUser)
    displayName.set(nextUser.profile.displayName ?? "")
    firstName.set(nextUser.profile.firstName ?? "")
    lastName.set(nextUser.profile.lastName ?? "")
    nickName.set(nextUser.profile.nickName ?? "")
    preferredLanguage.set(nextUser.profile.preferredLanguage ?? "")
  }
  const load = async (force = false) => {
    if (options.initialStatus === "loading" && !force) return
    status.set("loading")
    errorMessage.set(undefined)
    const result = await options.adapter.loadUser()
    if (!result.success) return resultFail(result)
    userApply(result.data.user)
    status.set("ready")
  }
  const profileSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    validationMessage.set(undefined)
    if (displayName.get().trim().length === 0) {
      validationMessage.set(messageTranslate("account.profile.displayNameRequired"))
      return
    }
    status.set("loading")
    const result = await options.adapter.updateProfile({
      displayName: displayName.get().trim(),
      firstName: firstName.get().trim() || null,
      lastName: lastName.get().trim() || null,
      nickName: nickName.get().trim() || null,
      preferredLanguage: preferredLanguage.get().trim() || null,
    })
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

  onMount(() => void load())
  return {
    accountDelete,
    confirmPassword,
    currentPassword,
    deletionConfirmation,
    displayName,
    errorMessage,
    firstName,
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
    preferredLanguage,
    profileSubmit,
    status,
    user,
    validationMessage,
  }
}
