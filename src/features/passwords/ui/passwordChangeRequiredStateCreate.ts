import { createEffect, onCleanup, onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

type PasswordChangeRequiredStateCreateOptions = {
  readonly confirmPassword: () => string
  readonly currentPassword: () => string
  readonly newPassword: () => string
  readonly onConfirmPassword: (value: string) => void
  readonly onCurrentPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: () => boolean
  readonly validationMessage: () => string | undefined
}

export function passwordChangeRequiredStateCreate(options: PasswordChangeRequiredStateCreateOptions) {
  const showPassword = createSignalObject(false)
  let currentPasswordInput: HTMLInputElement | undefined
  let newPasswordInput: HTMLInputElement | undefined

  const focus = (element: () => HTMLInputElement | undefined) => queueMicrotask(() => element()?.focus())
  const validationFocus = (message: string | undefined) => {
    if (message === undefined) return
    if (message.toLowerCase().includes("current")) {
      focus(() => currentPasswordInput)
      return
    }
    focus(() => newPasswordInput)
  }

  onMount(() => focus(() => currentPasswordInput))
  createEffect(() => validationFocus(options.validationMessage()))
  onCleanup(() => {
    options.onCurrentPassword("")
    options.onNewPassword("")
    options.onConfirmPassword("")
    showPassword.set(false)
  })

  return {
    confirmPassword: options.confirmPassword,
    currentPassword: options.currentPassword,
    newPassword: options.newPassword,
    onConfirmPassword: options.onConfirmPassword,
    onCurrentPassword: options.onCurrentPassword,
    onNewPassword: options.onNewPassword,
    onSubmit: (event: SubmitEvent) => {
      event.preventDefault()
      if (options.pending()) return
      options.onSubmit(event)
    },
    registerCurrentPassword: (element: HTMLInputElement) => {
      currentPasswordInput = element
    },
    registerNewPassword: (element: HTMLInputElement) => {
      newPasswordInput = element
    },
    showPassword: showPassword.get,
    toggleShowPassword: () => showPassword.set(!showPassword.get()),
  }
}
