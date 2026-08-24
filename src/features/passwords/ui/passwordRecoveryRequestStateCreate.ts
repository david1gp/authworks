import { createEffect, createMemo, onMount } from "solid-js"

type PasswordRecoveryRequestStateCreateOptions = {
  readonly email: () => string
  readonly onEmail: (value: string) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly pending: () => boolean
  readonly step: () => "loading" | "email" | "sent" | "fatal"
}

export function passwordRecoveryRequestStateCreate(options: PasswordRecoveryRequestStateCreateOptions) {
  let emailInput: HTMLInputElement | undefined
  let heading: HTMLHeadingElement | undefined

  const focusEmail = () => queueMicrotask(() => emailInput?.focus())
  const focusHeading = () => queueMicrotask(() => heading?.focus())
  onMount(() => (options.step() === "email" ? focusEmail() : focusHeading()))
  createEffect(() => {
    if (options.step() === "email") {
      focusEmail()
      return
    }
    focusHeading()
  })
  return {
    email: options.email,
    emailInput: options.onEmail,
    emailInputRegister: (element: HTMLInputElement) => {
      emailInput = element
    },
    headingRegister: (element: HTMLHeadingElement) => {
      heading = element
    },
    pending: options.pending,
    submit: (event: SubmitEvent) => {
      event.preventDefault()
      if (options.pending() || options.step() !== "email") return
      options.onSubmit(event)
    },
    valid: createMemo(() => {
      const value = options.email().trim()
      return value.length > 2 && value.includes("@")
    }),
  }
}
