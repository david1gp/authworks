import { createEffect, createMemo, onCleanup, onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

type PasswordResetStateCreateOptions = {
  readonly confirmPassword: () => string
  readonly newPassword: () => string
  readonly onConfirmPassword: (value: string) => void
  readonly onNewPassword: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: () => boolean
  readonly step: () => "loading" | "ready" | "invalid-link" | "complete"
  readonly validationMessage: () => string | undefined
}

export function passwordResetStateCreate(options: PasswordResetStateCreateOptions) {
  const showPassword = createSignalObject(false)
  let newPasswordInput: HTMLInputElement | undefined
  let heading: HTMLHeadingElement | undefined

  const focusPassword = () => queueMicrotask(() => newPasswordInput?.focus())
  const focusHeading = () => queueMicrotask(() => heading?.focus())
  const validationFocus = (message: string | undefined) => {
    if (message !== undefined && options.step() === "ready") focusPassword()
  }
  onMount(() => {
    if (options.step() === "ready") focusPassword()
    else focusHeading()
  })
  createEffect(() => {
    if (options.step() === "ready") focusPassword()
    else focusHeading()
    validationFocus(options.validationMessage())
  })
  onCleanup(() => {
    options.onNewPassword("")
    options.onConfirmPassword("")
    showPassword.set(false)
  })

  return {
    confirmPassword: options.confirmPassword,
    newPassword: options.newPassword,
    newPasswordInput: options.onNewPassword,
    newPasswordInputRegister: (element: HTMLInputElement) => {
      newPasswordInput = element
    },
    headingRegister: (element: HTMLHeadingElement) => {
      heading = element
    },
    onConfirmPassword: options.onConfirmPassword,
    pending: options.pending,
    showPassword: showPassword.get,
    submit: (event: SubmitEvent) => {
      event.preventDefault()
      if (options.pending() || options.step() !== "ready") return
      options.onSubmit(event)
    },
    toggleShowPassword: () => showPassword.set(!showPassword.get()),
    valid: createMemo(() => options.newPassword().length > 0 && options.confirmPassword().length > 0),
  }
}
