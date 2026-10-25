import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"

type ComplexityKey = "requireLowercase" | "requireNumber" | "requireSymbol" | "requireUppercase"

const complexityFields = [
  { key: "requireLowercase", labelKey: "admin.organizations.passwordPolicy.requireLowercase" },
  { key: "requireUppercase", labelKey: "admin.organizations.passwordPolicy.requireUppercase" },
  { key: "requireNumber", labelKey: "admin.organizations.passwordPolicy.requireNumber" },
  { key: "requireSymbol", labelKey: "admin.organizations.passwordPolicy.requireSymbol" },
] as const satisfies readonly { key: ComplexityKey; labelKey: MessageKey }[]

/** Realm password policy: complexity requirements and lockout limits for password sign-in. */
export function OrganizationAdminPasswordPolicyView(props: {
  readonly lockoutMinutes: number
  readonly onLockoutMinutesInput: (minutes: number) => void
  readonly onMaximumAttemptsInput: (value: number) => void
  readonly onMinimumLengthInput: (value: number) => void
  readonly onSubmit: (event: SubmitEvent) => void
  readonly onToggle: (key: ComplexityKey) => void
  readonly pending: boolean
  readonly policy: PasswordPolicy
  readonly validationMessage?: string
}) {
  return (
    <AuthenticatedSection
      description={messageTranslate("admin.organizations.passwordPolicy.description")}
      title={messageTranslate("admin.organizations.passwordPolicy.title")}
    >
      <form class="grid max-w-3xl gap-4 px-5 py-4" onSubmit={props.onSubmit}>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="grid min-w-0 gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="password-policy-minimum-length">
              {messageTranslate("admin.organizations.passwordPolicy.minimumLength")}
            </Label>
            <AuthenticatedInput
              id="password-policy-minimum-length"
              inputMode="numeric"
              min={1}
              max={72}
              onInput={(event) => props.onMinimumLengthInput(Number(event.currentTarget.value))}
              type="number"
              value={props.policy.minimumLength}
            />
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.organizations.passwordPolicy.minimumLengthHint")}
            </p>
          </div>
          <div class="grid min-w-0 gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="password-policy-maximum-attempts">
              {messageTranslate("admin.organizations.passwordPolicy.maximumAttempts")}
            </Label>
            <AuthenticatedInput
              id="password-policy-maximum-attempts"
              inputMode="numeric"
              min={1}
              max={100}
              onInput={(event) => props.onMaximumAttemptsInput(Number(event.currentTarget.value))}
              type="number"
              value={props.policy.maximumAttempts}
            />
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.organizations.passwordPolicy.maximumAttemptsHint")}
            </p>
          </div>
          <div class="grid min-w-0 gap-1.5">
            <Label class="text-[0.8125rem] font-medium" for="password-policy-lockout-minutes">
              {messageTranslate("admin.organizations.passwordPolicy.lockoutMinutes")}
            </Label>
            <AuthenticatedInput
              id="password-policy-lockout-minutes"
              inputMode="numeric"
              min={1}
              onInput={(event) => props.onLockoutMinutesInput(Number(event.currentTarget.value))}
              type="number"
              value={props.lockoutMinutes}
            />
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.organizations.passwordPolicy.lockoutMinutesHint")}
            </p>
          </div>
        </div>
        <div class="grid items-start gap-2 sm:grid-cols-2">
          <For each={complexityFields}>
            {(field) => (
              <label
                class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-control border border-line-subtle px-3 py-3 text-[0.8125rem] font-medium"
                for={`password-policy-${field.key}`}
              >
                <input
                  checked={props.policy[field.key]}
                  class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                  id={`password-policy-${field.key}`}
                  onChange={() => props.onToggle(field.key)}
                  type="checkbox"
                />
                <span class="min-w-0">{messageTranslate(field.labelKey)}</span>
              </label>
            )}
          </For>
        </div>
        <Show when={props.validationMessage}>
          {(message) => <AuthenticatedNotice message={message()} tone="danger" />}
        </Show>
        <div class="flex justify-end">
          <AuthenticatedButton disabled={props.pending} icon={mdiContentSave} type="submit" variant="filledBlue">
            {messageTranslate("common.save")}
          </AuthenticatedButton>
        </div>
      </form>
    </AuthenticatedSection>
  )
}
