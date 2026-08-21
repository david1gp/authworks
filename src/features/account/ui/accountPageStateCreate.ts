import { onMount } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasswordMeChangeResponse } from "../../passwords/public/passwordMeChangeResponseSchema.js"
import type { UserProfileUpdateRequest } from "../../users/public/userProfileUpdateRequestSchema.js"
import type { UserResponse } from "../../users/public/userResponseSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { AccountViewStatus } from "./accountViewStatusSchema.js"

type AccountPageAdapter = {
  readonly deleteAccount: () => Promise<Result<UserResponse>>
  readonly loadUser: () => Promise<Result<UserResponse>>
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
    preferredLanguage,
    profileSubmit,
    status,
    user,
    validationMessage,
  }
}
