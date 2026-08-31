import { type Accessor, onMount } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasswordMeChangeResponse } from "../../passwords/public/passwordMeChangeResponseSchema.js"
import type { UserEmailAddressAddResendRequest } from "../../users/public/userEmailAddressAddResendRequestSchema.js"
import type { UserEmailAddressAddResendResponse } from "../../users/public/userEmailAddressAddResendResponseSchema.js"
import { userEmailAddressAddStartRequestSchema } from "../../users/public/userEmailAddressAddStartRequestSchema.js"
import type { UserEmailAddressAddStartResponse } from "../../users/public/userEmailAddressAddStartResponseSchema.js"
import type { UserEmailAddressAddVerifyRequest } from "../../users/public/userEmailAddressAddVerifyRequestSchema.js"
import { userEmailAddressAddVerifyRequestSchema } from "../../users/public/userEmailAddressAddVerifyRequestSchema.js"
import type { UserEmailAddressAddVerifyResponse } from "../../users/public/userEmailAddressAddVerifyResponseSchema.js"
import type { UserEmailAddressListResponse } from "../../users/public/userEmailAddressListResponseSchema.js"
import type { UserEmailAddressPrimarySetResponse } from "../../users/public/userEmailAddressPrimarySetResponseSchema.js"
import type { UserEmailAddressRemoveResponse } from "../../users/public/userEmailAddressRemoveResponseSchema.js"
import type { UserEmailAddress } from "../../users/public/userEmailAddressSchema.js"
import { userPictureConstraints } from "../../users/public/userPictureConstraints.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import type { UserResponse } from "../../users/public/userResponseSchema.js"
import type { User } from "../../users/public/userSchema.js"
import { whatsappOtpPhoneChangeStartRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartRequestSchema.js"
import type { WhatsappOtpPhoneChangeStartResponse } from "../../whatsappOtp/public/whatsappOtpPhoneChangeStartResponseSchema.js"
import { whatsappOtpPhoneChangeVerifyRequestSchema } from "../../whatsappOtp/public/whatsappOtpPhoneChangeVerifyRequestSchema.js"
import type { AccountEmailViewStatus } from "./accountEmailViewStatus.js"
import type { AccountPhoneViewStatus } from "./accountPhoneViewStatus.js"
import type { AccountPictureViewStatus } from "./accountPictureViewStatus.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountPageAdapter = {
  readonly deleteAccount: () => Promise<Result<UserResponse>>
  readonly emailAddressAddDemoToken?: string
  readonly emailAddressAddResend: (
    input: UserEmailAddressAddResendRequest,
  ) => Promise<Result<UserEmailAddressAddResendResponse>>
  readonly emailAddressAddStart: (input: { email: string }) => Promise<Result<UserEmailAddressAddStartResponse>>
  readonly emailAddressAddVerify: (
    input: UserEmailAddressAddVerifyRequest,
  ) => Promise<Result<UserEmailAddressAddVerifyResponse>>
  readonly emailAddressList: () => Promise<Result<UserEmailAddressListResponse>>
  readonly emailAddressPrimarySet: (emailId: string) => Promise<Result<UserEmailAddressPrimarySetResponse>>
  readonly emailAddressRemove: (emailId: string) => Promise<Result<UserEmailAddressRemoveResponse>>
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
  readonly profilePictureRemove: () => Promise<Result<UserResponse>>
  readonly profilePictureUpload: (file: Blob) => Promise<Result<UserResponse>>
  readonly updatePassword: (input: {
    currentPassword: string
    newPassword: string
  }) => Promise<Result<PasswordMeChangeResponse>>
  readonly updateProfile: (input: UserProfileUpdateRequest) => Promise<Result<UserResponse>>
}

export function accountPageStateCreate(options: {
  readonly adapter: AccountPageAdapter
  readonly initialStatus?: AccountViewStatus
  readonly kind:
    | "delete"
    | "email"
    | "overview"
    | "password"
    | "profile"
    | Accessor<"delete" | "email" | "overview" | "password" | "profile">
}) {
  const kind = typeof options.kind === "function" ? options.kind : () => options.kind
  const status = createSignalObject<AccountViewStatus>(options.initialStatus ?? "loading")
  const user = createSignalObject<User | undefined>(undefined)
  const errorMessage = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const displayName = createSignalObject("")
  const firstName = createSignalObject("")
  const gender = createSignalObject("")
  const lastName = createSignalObject("")
  const nickName = createSignalObject("")
  const pictureErrorMessage = createSignalObject<string | undefined>(undefined)
  const pictureStatus = createSignalObject<AccountPictureViewStatus>("idle")
  const pictureUrl = createSignalObject("")
  const preferredLanguage = createSignalObject("")
  const currentPassword = createSignalObject("")
  const newPassword = createSignalObject("")
  const confirmPassword = createSignalObject("")
  const passwordDialogOpen = createSignalObject(false)
  const deletionConfirmation = createSignalObject("")
  const phoneAddDialogOpen = createSignalObject(false)
  const phoneCandidate = createSignalObject("")
  const phoneChallengeId = createSignalObject<string | undefined>(undefined)
  const phoneCode = createSignalObject("")
  const phoneErrorMessage = createSignalObject<string | undefined>(undefined)
  const phoneStatus = createSignalObject<AccountPhoneViewStatus>("idle")
  const phoneValidationMessage = createSignalObject<string | undefined>(undefined)
  const emailAddDialogOpen = createSignalObject(false)
  const emailCandidate = createSignalObject("")
  const emailChallengeId = createSignalObject<string | undefined>(undefined)
  const emailToken = createSignalObject("")
  const emailErrorMessage = createSignalObject<string | undefined>(undefined)
  const emailStatus = createSignalObject<AccountEmailViewStatus>("idle")
  const emailValidationMessage = createSignalObject<string | undefined>(undefined)
  const emailAddresses = createSignalObject<readonly UserEmailAddress[]>([])
  const emailActionId = createSignalObject<string | undefined>(undefined)
  let loadGeneration = 0

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
    pictureUrl.set(nextUser.profile.picture?.url ?? "")
    preferredLanguage.set(nextUser.profile.preferredLanguage ?? "")
  }
  /** Mirrors the server validator so an unusable file never reaches the upload route. */
  const pictureFileValidate = (file: File) => {
    if (!(userPictureConstraints.contentTypes as readonly string[]).includes(file.type))
      return messageTranslate("account.profile.pictureTypeInvalid")
    if (file.size === 0 || file.size > userPictureConstraints.maximumBytes)
      return messageTranslate("account.profile.pictureTooLarge")
    return undefined
  }
  const pictureUpload = async (file: File) => {
    pictureErrorMessage.set(undefined)
    const invalid = pictureFileValidate(file)
    if (invalid !== undefined) {
      pictureErrorMessage.set(invalid)
      pictureStatus.set("error")
      return
    }
    pictureStatus.set("uploading")
    const result = await options.adapter.profilePictureUpload(file)
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      pictureErrorMessage.set(result.errorMessage)
      pictureStatus.set("error")
      return
    }
    userApply(result.data.user)
    pictureStatus.set("success")
  }
  const pictureRemove = async () => {
    pictureErrorMessage.set(undefined)
    pictureStatus.set("removing")
    const result = await options.adapter.profilePictureRemove()
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      pictureErrorMessage.set(result.errorMessage)
      pictureStatus.set("error")
      return
    }
    userApply(result.data.user)
    pictureStatus.set("success")
  }
  const load = async (force = false) => {
    if (options.initialStatus === "loading" && !force) return
    const loadGenerationSnapshot = ++loadGeneration
    const loadKind = kind()
    status.set("loading")
    errorMessage.set(undefined)
    const userResult = await options.adapter.loadUser()
    if (loadGenerationSnapshot !== loadGeneration) return
    if (!userResult.success) return resultFail(userResult)
    userApply(userResult.data.user)
    if (loadKind === "email") {
      const addressResult = await options.adapter.emailAddressList()
      if (loadGenerationSnapshot !== loadGeneration) return
      if (!addressResult.success) return resultFail(addressResult)
      emailAddresses.set(addressResult.data.items)
    }
    if (loadGenerationSnapshot !== loadGeneration) return
    phoneAddDialogOpen.set(false)
    phoneCandidate.set("")
    phoneChallengeId.set(undefined)
    phoneCode.set("")
    phoneErrorMessage.set(undefined)
    phoneValidationMessage.set(undefined)
    phoneStatus.set("idle")
    emailAddDialogOpen.set(false)
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailErrorMessage.set(undefined)
    emailValidationMessage.set(undefined)
    emailStatus.set("idle")
    emailActionId.set(undefined)
    status.set("ready")
  }
  const profileSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    validationMessage.set(undefined)
    if (displayName.get().trim().length === 0) {
      validationMessage.set(messageTranslate("account.profile.displayNameRequired"))
      return
    }
    // The picture is owned by the dedicated upload and removal endpoints, so it never travels with this patch.
    const profileInput = {
      displayName: displayName.get().trim(),
      firstName: firstName.get().trim() || null,
      gender: gender.get().trim() || null,
      lastName: lastName.get().trim() || null,
      nickName: nickName.get().trim() || null,
      preferredLanguage: preferredLanguage.get().trim() || null,
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
  const passwordDialogOpenSet = (open: boolean) => {
    if (!open) {
      currentPassword.set("")
      newPassword.set("")
      confirmPassword.set("")
      errorMessage.set(undefined)
      validationMessage.set(undefined)
      status.set("ready")
    }
    passwordDialogOpen.set(open)
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
    phoneAddDialogOpen.set(false)
  }
  const phoneChangeCancel = () => {
    phoneChallengeId.set(undefined)
    phoneCode.set("")
    phoneOperationPrepare()
    phoneStatus.set("idle")
  }
  /** Closing the dialog abandons any in-flight challenge so a reopened dialog starts clean. */
  const phoneAddDialogOpenSet = (open: boolean) => {
    if (!open) {
      phoneCandidate.set("")
      phoneChangeCancel()
    }
    phoneAddDialogOpen.set(open)
  }

  const emailOperationPrepare = () => {
    emailErrorMessage.set(undefined)
    emailValidationMessage.set(undefined)
  }
  const emailAddressAddStart = async (event: SubmitEvent) => {
    event.preventDefault()
    emailOperationPrepare()
    const parsed = v.safeParse(userEmailAddressAddStartRequestSchema, { email: emailCandidate.get().trim() })
    if (!parsed.success) {
      emailValidationMessage.set(messageTranslate("account.profile.emailInvalid"))
      return
    }
    emailCandidate.set(parsed.output.email)
    emailStatus.set("sending")
    const result = await options.adapter.emailAddressAddStart(parsed.output)
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailChallengeId.set(result.data.challengeId)
    emailToken.set(options.adapter.emailAddressAddDemoToken ?? "")
    emailStatus.set("code")
  }
  const emailAddressAddResend = async () => {
    const challengeId = emailChallengeId.get()
    if (challengeId === undefined) return
    emailOperationPrepare()
    emailStatus.set("sending")
    const result = await options.adapter.emailAddressAddResend({ challengeId, email: emailCandidate.get() })
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailChallengeId.set(result.data.challengeId)
    emailToken.set(options.adapter.emailAddressAddDemoToken ?? emailToken.get())
    emailStatus.set("code")
  }
  const emailAddressAddVerify = async (event: SubmitEvent) => {
    event.preventDefault()
    emailOperationPrepare()
    const parsed = v.safeParse(userEmailAddressAddVerifyRequestSchema, {
      challengeId: emailChallengeId.get(),
      token: emailToken.get().trim(),
    })
    if (!parsed.success) {
      emailValidationMessage.set(messageTranslate("account.profile.emailTokenInvalid"))
      return
    }
    emailStatus.set("verifying")
    const result = await options.adapter.emailAddressAddVerify(parsed.output)
    if (!result.success) {
      if (resultIsExpired(result)) return resultFail(result)
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailAddresses.set([
      ...emailAddresses.get().filter((address) => address.id !== result.data.email.id),
      result.data.email,
    ])
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailStatus.set("success")
    emailAddDialogOpen.set(false)
  }
  const emailAddressAddCancel = () => {
    emailCandidate.set("")
    emailChallengeId.set(undefined)
    emailToken.set("")
    emailOperationPrepare()
    emailStatus.set("idle")
  }
  /** Closing the dialog abandons any in-flight challenge so a reopened dialog starts clean. */
  const emailAddDialogOpenSet = (open: boolean) => {
    if (!open) emailAddressAddCancel()
    emailAddDialogOpen.set(open)
  }
  const emailAddressPrimarySet = async (emailId: string) => {
    const address = emailAddresses.get().find((candidate) => candidate.id === emailId)
    if (address === undefined || address.isPrimary || !address.verified) return
    emailOperationPrepare()
    emailActionId.set(emailId)
    emailStatus.set("sending")
    const result = await options.adapter.emailAddressPrimarySet(emailId)
    if (!result.success) {
      emailActionId.set(undefined)
      if (resultIsExpired(result)) return resultFail(result)
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailAddresses.set(
      emailAddresses
        .get()
        .map((candidate) =>
          candidate.id === result.data.email.id ? result.data.email : { ...candidate, isPrimary: false },
        ),
    )
    const currentUser = user.get()
    if (currentUser !== undefined)
      userApply({
        ...currentUser,
        email: result.data.email.email,
        emailVerified: result.data.email.verified,
        ...(result.data.email.verifiedAt === null ? {} : { emailVerifiedAt: result.data.email.verifiedAt }),
      })
    emailActionId.set(undefined)
    emailStatus.set("success")
  }
  const emailAddressRemove = async (emailId: string) => {
    const address = emailAddresses.get().find((candidate) => candidate.id === emailId)
    if (address === undefined || address.isPrimary) return
    emailOperationPrepare()
    emailActionId.set(emailId)
    emailStatus.set("sending")
    const result = await options.adapter.emailAddressRemove(emailId)
    if (!result.success) {
      emailActionId.set(undefined)
      if (resultIsExpired(result)) return resultFail(result)
      emailErrorMessage.set(result.errorMessage)
      emailStatus.set("error")
      return
    }
    emailAddresses.set(emailAddresses.get().filter((candidate) => candidate.id !== emailId))
    emailActionId.set(undefined)
    emailStatus.set("success")
  }

  onMount(() => {
    void (async () => {
      await load()
      if (typeof window === "undefined") return
      const query = new URLSearchParams(window.location.search)
      const token = query.get("token")
      const challengeId = query.get("challengeId")
      if (token === null || challengeId === null) return
      const parsed = v.safeParse(userEmailAddressAddVerifyRequestSchema, { challengeId, token })
      if (!parsed.success) return
      emailChallengeId.set(parsed.output.challengeId)
      emailToken.set(parsed.output.token)
      emailStatus.set("code")
      // The verification link lands on the account page, so the add dialog reopens on its code step.
      emailAddDialogOpen.set(true)
      query.delete("challengeId")
      query.delete("token")
      const queryString = query.toString()
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${queryString.length === 0 ? "" : `?${queryString}`}${window.location.hash}`,
      )
    })()
  })
  return {
    accountDelete,
    confirmPassword,
    currentPassword,
    deletionConfirmation,
    displayName,
    emailAddDialogOpen,
    emailAddDialogOpenSet,
    emailCandidate,
    emailChallengeId,
    emailActionId,
    emailAddressAddCancel,
    emailAddressAddResend,
    emailAddressAddStart,
    emailAddressAddVerify,
    emailAddressPrimarySet,
    emailAddressRemove,
    emailAddresses,
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
    passwordDialogOpen,
    passwordDialogOpenSet,
    phoneAddDialogOpen,
    phoneAddDialogOpenSet,
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
    pictureErrorMessage,
    pictureRemove,
    pictureStatus,
    pictureUpload,
    pictureUrl,
    preferredLanguage,
    profileSubmit,
    status,
    user,
    validationMessage,
  }
}
