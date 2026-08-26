import { For, Show } from "solid-js"
import { Button } from "#ui/interactive/button/Button.jsx"
import { Badge } from "#ui/static/badge/Badge.jsx"
import { CardWrapper } from "#ui/static/card/CardWrapper.jsx"
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
  const scopeBadge = () =>
    props.scope === "realm"
      ? messageTranslate("admin.organizations.policy.realmValue")
      : messageTranslate("admin.organizations.policy.organizationValue")
  const inheritanceControl = (key: SecurityPolicyKey) => (
    <Show when={props.scope === "organization"}>
      <label class="flex items-center gap-2 text-sm">
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
  const fieldBadge = (key: SecurityPolicyKey) => (
    <Badge variant="outline">
      {props.fieldInherited(key) ? messageTranslate("admin.organizations.policy.inherited") : scopeBadge()}
    </Badge>
  )

  return (
    <CardWrapper>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">{messageTranslate("admin.organizations.policy.securityTitle")}</h2>
          <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.policy.securityDescription")}
          </p>
        </div>
        <Badge variant="outline">{scopeBadge()}</Badge>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <fieldset class="rounded-xl border border-line p-4">
          <legend class="w-full font-semibold">
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span>{messageTranslate("admin.organizations.policy.requiredMfa")}</span>
              {fieldBadge("requiredMfa")}
            </span>
          </legend>
          <p class="mt-2 text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.policy.effectiveValue", {
              value: props.requiredMfa
                ? messageTranslate("admin.organizations.policy.required")
                : messageTranslate("admin.organizations.policy.notRequired"),
            })}
          </p>
          <div class="mt-3">{inheritanceControl("requiredMfa")}</div>
          <select
            aria-label={messageTranslate("admin.organizations.policy.requiredMfa")}
            class="mt-3 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm sm:max-w-xs"
            disabled={props.fieldInherited("requiredMfa")}
            onChange={(event) => props.onRequiredMfaInput(event.currentTarget.value === "required")}
            value={props.requiredMfa ? "required" : "optional"}
          >
            <option value="optional">{messageTranslate("admin.organizations.policy.notRequired")}</option>
            <option value="required">{messageTranslate("admin.organizations.policy.required")}</option>
          </select>
        </fieldset>

        <fieldset class="rounded-xl border border-line p-4">
          <legend class="w-full font-semibold">
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span>{messageTranslate("admin.organizations.policy.minimumAssurance")}</span>
              {fieldBadge("minimumStepUpAssurance")}
            </span>
          </legend>
          <p class="mt-2 text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.policy.effectiveValue", {
              value: messageTranslate(`admin.organizations.policy.assurance.${props.assurance}`),
            })}
          </p>
          <div class="mt-3">{inheritanceControl("minimumStepUpAssurance")}</div>
          <select
            aria-label={messageTranslate("admin.organizations.policy.minimumAssurance")}
            class="mt-3 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm sm:max-w-xs"
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

        <fieldset class="rounded-xl border border-line p-4 lg:col-span-2">
          <legend class="w-full font-semibold">
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span>{messageTranslate("admin.organizations.policy.allowedFactors")}</span>
              {fieldBadge("allowedFactors")}
            </span>
          </legend>
          <p class="mt-2 text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.policy.allowedFactorsDescription")}
          </p>
          <div class="mt-3">{inheritanceControl("allowedFactors")}</div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <For each={factors}>
              {(factor) => (
                <label class="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
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

        <fieldset class="rounded-xl border border-line p-4 lg:col-span-2">
          <legend class="w-full font-semibold">
            <span class="flex flex-wrap items-center justify-between gap-2">
              <span>{messageTranslate("admin.organizations.policy.preferredOrder")}</span>
              {fieldBadge("preferredFactorOrder")}
            </span>
          </legend>
          <p class="mt-2 text-sm text-muted-foreground">
            {messageTranslate("admin.organizations.policy.preferredOrderDescription")}
          </p>
          <div class="mt-3">{inheritanceControl("preferredFactorOrder")}</div>
          <ol class="mt-3 grid gap-2" aria-label={messageTranslate("admin.organizations.policy.preferredOrder")}>
            <For each={props.order}>
              {(factor, index) => (
                <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <span class="text-sm">
                    {index() + 1}. {messageTranslate(factorLabelKeys[factor])}
                  </span>
                  <div class="flex gap-2">
                    <Button
                      aria-label={messageTranslate("admin.organizations.policy.moveUp", {
                        factor: messageTranslate(factorLabelKeys[factor]),
                      })}
                      disabled={props.fieldInherited("preferredFactorOrder") || index() === 0}
                      onClick={() => props.onPreferredFactorMove(factor, -1)}
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.policy.up")}
                    </Button>
                    <Button
                      aria-label={messageTranslate("admin.organizations.policy.moveDown", {
                        factor: messageTranslate(factorLabelKeys[factor]),
                      })}
                      disabled={props.fieldInherited("preferredFactorOrder") || index() === props.order.length - 1}
                      onClick={() => props.onPreferredFactorMove(factor, 1)}
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

      <div class="mt-4 rounded-xl border border-line bg-muted/30 p-4" aria-live="polite">
        <h3 class="font-semibold">{messageTranslate("admin.organizations.policy.enforcementTitle")}</h3>
        <p class="mt-2 text-sm">
          {props.requiredMfa
            ? messageTranslate("admin.organizations.policy.enforcementRequired")
            : messageTranslate("admin.organizations.policy.enforcementOptional")}
        </p>
        <p class="mt-1 text-sm">
          {props.assurance === "multi_factor"
            ? messageTranslate("admin.organizations.policy.enforcementMultiFactor")
            : props.assurance === "authenticated"
              ? messageTranslate("admin.organizations.policy.enforcementAuthenticated")
              : messageTranslate("admin.organizations.policy.enforcementNone")}
        </p>
        <Show when={props.requiredMfa}>
          <p class="mt-2 text-sm font-medium">{messageTranslate("admin.organizations.policy.remediation")}</p>
        </Show>
      </div>
      <Show when={props.validationMessage}>
        {(message) => (
          <p class="mt-4 text-sm text-danger" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </CardWrapper>
  )
}
