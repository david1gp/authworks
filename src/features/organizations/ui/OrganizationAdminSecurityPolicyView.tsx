import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { AuthenticatedNotice } from "../../../ui/authenticated/AuthenticatedNotice.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import type { OrganizationLoginPolicyAssurance } from "../public/organizationLoginPolicyAssuranceSchema.js"

const factors: readonly MfaPolicyFactor[] = ["totp", "email_otp", "passkey"]
const factorLabelKeys = {
  email_otp: "admin.organizations.policy.factor.emailOtp",
  passkey: "admin.organizations.policy.factor.passkey",
  totp: "admin.organizations.policy.factor.totp",
} as const satisfies Readonly<Record<MfaPolicyFactor, MessageKey>>
const fieldsetClass = "min-w-0 rounded-control border border-line-subtle px-3 py-2.5"
const selectClass =
  "mt-2 h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-foreground sm:max-w-xs"

type SecurityPolicyKey = "allowedFactors" | "minimumStepUpAssurance" | "preferredFactorOrder" | "requiredMfa"

export function OrganizationAdminSecurityPolicyView(props: {
  readonly allowedFactors: readonly MfaPolicyFactor[]
  readonly assurance: OrganizationLoginPolicyAssurance
  readonly fieldInherited: (key: SecurityPolicyKey) => boolean
  readonly onAllowedFactorToggle: (factor: MfaPolicyFactor) => void
  readonly onAssuranceInput: (value: OrganizationLoginPolicyAssurance) => void
  readonly onFieldOverrideSet: (key: SecurityPolicyKey, overridden: boolean) => void
  readonly onPreferredFactorMove: (factor: MfaPolicyFactor, direction: -1 | 1) => void
  readonly onRequiredMfaInput: (value: boolean) => void
  readonly order: readonly MfaPolicyFactor[]
  readonly requiredMfa: boolean
  readonly scope: "organization" | "realm"
  readonly validationMessage?: string
}) {
  const scopeLabel = () =>
    props.scope === "realm"
      ? messageTranslate("admin.organizations.policy.realmValue")
      : messageTranslate("admin.organizations.policy.organizationValue")
  const inheritanceControl = (key: SecurityPolicyKey) => (
    <Show when={props.scope === "organization"}>
      <label class="mt-2 flex items-center gap-2 text-xs font-medium">
        <input
          checked={!props.fieldInherited(key)}
          class="size-4 rounded border-line"
          onChange={(event) => props.onFieldOverrideSet(key, event.currentTarget.checked)}
          type="checkbox"
        />
        {messageTranslate("admin.organizations.policy.overrideRealm")}
      </label>
    </Show>
  )
  const fieldLegend = (key: SecurityPolicyKey, label: string) => (
    <legend class="flex w-full flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-semibold">{label}</span>
      <AuthenticatedStatus
        label={props.fieldInherited(key) ? messageTranslate("admin.organizations.policy.inherited") : scopeLabel()}
        tone={props.fieldInherited(key) ? "neutral" : "accent"}
      />
    </legend>
  )

  return (
    <AuthenticatedSection
      actions={<AuthenticatedStatus label={scopeLabel()} tone="neutral" />}
      description={messageTranslate("admin.organizations.policy.securityDescription")}
      padded
      title={messageTranslate("admin.organizations.policy.securityTitle")}
    >
      <div class="grid min-w-0 gap-2.5 lg:grid-cols-2 [&>*]:min-w-0">
        <fieldset class={fieldsetClass}>
          {fieldLegend("requiredMfa", messageTranslate("admin.organizations.policy.requiredMfa"))}
          <p class="mt-1 text-xs text-muted-foreground">
            {messageTranslate("admin.organizations.policy.effectiveValue", {
              value: props.requiredMfa
                ? messageTranslate("admin.organizations.policy.required")
                : messageTranslate("admin.organizations.policy.notRequired"),
            })}
          </p>
          {inheritanceControl("requiredMfa")}
          <select
            aria-label={messageTranslate("admin.organizations.policy.requiredMfa")}
            class={selectClass}
            disabled={props.fieldInherited("requiredMfa")}
            onChange={(event) => props.onRequiredMfaInput(event.currentTarget.value === "required")}
            value={props.requiredMfa ? "required" : "optional"}
          >
            <option value="optional">{messageTranslate("admin.organizations.policy.notRequired")}</option>
            <option value="required">{messageTranslate("admin.organizations.policy.required")}</option>
          </select>
        </fieldset>

        <fieldset class={fieldsetClass}>
          {fieldLegend("minimumStepUpAssurance", messageTranslate("admin.organizations.policy.minimumAssurance"))}
          <p class="mt-1 text-xs text-muted-foreground">
            {messageTranslate("admin.organizations.policy.effectiveValue", {
              value: messageTranslate(`admin.organizations.policy.assurance.${props.assurance}`),
            })}
          </p>
          {inheritanceControl("minimumStepUpAssurance")}
          <select
            aria-label={messageTranslate("admin.organizations.policy.minimumAssurance")}
            class={selectClass}
            disabled={props.fieldInherited("minimumStepUpAssurance")}
            onChange={(event) => props.onAssuranceInput(event.currentTarget.value as OrganizationLoginPolicyAssurance)}
            value={props.assurance}
          >
            <option value="none">{messageTranslate("admin.organizations.policy.assurance.none")}</option>
            <option value="authenticated">
              {messageTranslate("admin.organizations.policy.assurance.authenticated")}
            </option>
            <option value="multi_factor">
              {messageTranslate("admin.organizations.policy.assurance.multi_factor")}
            </option>
          </select>
        </fieldset>

        <fieldset class={fieldsetClass}>
          {fieldLegend("allowedFactors", messageTranslate("admin.organizations.policy.allowedFactors"))}
          <p class="mt-1 text-xs text-muted-foreground">
            {messageTranslate("admin.organizations.policy.allowedFactorsDescription")}
          </p>
          {inheritanceControl("allowedFactors")}
          <div class="mt-2 grid gap-1.5">
            <For each={factors}>
              {(factor) => (
                <label class="flex min-h-9 items-center gap-2 rounded-control border border-line-subtle px-2 text-xs font-medium">
                  <input
                    checked={props.allowedFactors.includes(factor)}
                    class="size-4 rounded border-line"
                    disabled={props.fieldInherited("allowedFactors")}
                    onChange={() => props.onAllowedFactorToggle(factor)}
                    type="checkbox"
                  />
                  {messageTranslate(factorLabelKeys[factor])}
                </label>
              )}
            </For>
          </div>
        </fieldset>

        <fieldset class={fieldsetClass}>
          {fieldLegend("preferredFactorOrder", messageTranslate("admin.organizations.policy.preferredOrder"))}
          <p class="mt-1 text-xs text-muted-foreground">
            {messageTranslate("admin.organizations.policy.preferredOrderDescription")}
          </p>
          {inheritanceControl("preferredFactorOrder")}
          <ol aria-label={messageTranslate("admin.organizations.policy.preferredOrder")} class="mt-2 grid gap-1.5">
            <For each={props.order}>
              {(factor, index) => (
                <li class="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-control border border-line-subtle px-2 py-1.5">
                  <span class="min-w-0 truncate text-xs font-medium tabular-nums">
                    {index() + 1}. {messageTranslate(factorLabelKeys[factor])}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <Button
                      aria-label={messageTranslate("admin.organizations.policy.moveUp", {
                        factor: messageTranslate(factorLabelKeys[factor]),
                      })}
                      class="h-7 text-xs"
                      disabled={props.fieldInherited("preferredFactorOrder") || index() === 0}
                      onClick={() => props.onPreferredFactorMove(factor, -1)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.policy.up")}
                    </Button>
                    <Button
                      aria-label={messageTranslate("admin.organizations.policy.moveDown", {
                        factor: messageTranslate(factorLabelKeys[factor]),
                      })}
                      class="h-7 text-xs"
                      disabled={props.fieldInherited("preferredFactorOrder") || index() === props.order.length - 1}
                      onClick={() => props.onPreferredFactorMove(factor, 1)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.policy.down")}
                    </Button>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </fieldset>
      </div>

      <div aria-live="polite" class="mt-2.5 rounded-control border border-line-subtle bg-muted px-3 py-2.5">
        <h3 class="text-xs font-semibold">{messageTranslate("admin.organizations.policy.enforcementTitle")}</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          {props.requiredMfa
            ? messageTranslate("admin.organizations.policy.enforcementRequired")
            : messageTranslate("admin.organizations.policy.enforcementOptional")}
        </p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {props.assurance === "multi_factor"
            ? messageTranslate("admin.organizations.policy.enforcementMultiFactor")
            : props.assurance === "authenticated"
              ? messageTranslate("admin.organizations.policy.enforcementAuthenticated")
              : messageTranslate("admin.organizations.policy.enforcementNone")}
        </p>
        <Show when={props.requiredMfa}>
          <p class="mt-1 text-xs font-medium">{messageTranslate("admin.organizations.policy.remediation")}</p>
        </Show>
      </div>

      <Show when={props.validationMessage}>
        {(message) => <AuthenticatedNotice class="mt-2.5" message={message()} tone="danger" />}
      </Show>
    </AuthenticatedSection>
  )
}
