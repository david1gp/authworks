import { mdiCancel } from "@adaptive-ds/mdi/mdiCancel.js"
import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { For, Show } from "solid-js"
import { Label } from "#ui/input/label/Label.jsx"
import { Icon } from "#ui/static/icon/Icon.jsx"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
import { AuthenticatedInput } from "../../../ui/authenticated/AuthenticatedInput.js"
import { AuthenticatedSection } from "../../../ui/authenticated/AuthenticatedSection.js"
import { AuthenticatedStatus } from "../../../ui/authenticated/AuthenticatedStatus.js"
import { authenticatedControlClasses } from "../../../ui/authenticated/authenticatedControlClasses.js"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { OrganizationAdminNotice } from "./OrganizationAdminNotice.js"
import { OrganizationAdminSecurityPolicyView } from "./OrganizationAdminSecurityPolicyView.js"
import { OrganizationAdminState } from "./OrganizationAdminState.js"
import type { organizationAdminPageStateCreate } from "./organizationAdminPageStateCreate.js"
import type { organizationAdminScreenStateCreate } from "./organizationAdminScreenStateCreate.js"

type ConfigurationPage = ReturnType<typeof organizationAdminPageStateCreate>
type ConfigurationScreen = ReturnType<typeof organizationAdminScreenStateCreate>

type PolicyKey = keyof Omit<
  OrganizationLoginPolicy,
  | "allowedFactors"
  | "minimumStepUpAssurance"
  | "preferredFactorOrder"
  | "providerIds"
  | "requiredMfa"
  | "sessionLifetimeSeconds"
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"
>

type PolicyMfaLifetimeKey =
  | "mfaInitSkipLifetimeSeconds"
  | "secondFactorCheckLifetimeSeconds"
  | "multiFactorCheckLifetimeSeconds"

const policyFields = [
  { key: "allowPassword", labelKey: "admin.organizations.policy.password" },
  { key: "allowPasswordRecovery", labelKey: "admin.organizations.policy.passwordRecovery" },
  { key: "allowPasskey", labelKey: "admin.organizations.policy.passkey" },
  { key: "allowEmailOtp", labelKey: "admin.organizations.policy.emailOtp" },
  { key: "allowWhatsappOtp", labelKey: "admin.organizations.policy.whatsappOtp" },
  { key: "allowExternalIdentity", labelKey: "admin.organizations.policy.externalIdentity" },
  { key: "allowExternalIdentityAutoLinking", labelKey: "admin.organizations.policy.autoLinking" },
  { key: "forceMfaLocalOnly", labelKey: "admin.organizations.policy.forceMfaLocalOnly" },
  { key: "allowRegistration", labelKey: "admin.organizations.policy.registration" },
  { key: "allowDomainDiscovery", labelKey: "admin.organizations.policy.domainDiscovery" },
] as const satisfies readonly { key: PolicyKey; labelKey: MessageKey }[]

const policyMfaLifetimeFields = [
  { key: "mfaInitSkipLifetimeSeconds", labelKey: "admin.organizations.policy.mfaInitSkipLifetime" },
  { key: "secondFactorCheckLifetimeSeconds", labelKey: "admin.organizations.policy.secondFactorLifetime" },
  { key: "multiFactorCheckLifetimeSeconds", labelKey: "admin.organizations.policy.multiFactorLifetime" },
] as const satisfies readonly { key: PolicyMfaLifetimeKey; labelKey: MessageKey }[]

/** Sign-in section: login policy toggles per card plus the MFA and assurance card. */
export function OrganizationConfigurationSignInSection(props: {
  readonly canEdit: boolean
  readonly page: ConfigurationPage
  readonly screen: ConfigurationScreen
}) {
  const policy = () => props.screen.policyDraft()
  return (
    <OrganizationAdminState
      emptyDetail={messageTranslate("admin.organizations.configuration.signInDescription")}
      error={props.page.error()}
      onRetry={props.page.reload}
      status={props.page.status()}
    >
      <OrganizationAdminNotice notice={props.page.notice()} />
      <div class="grid min-w-0 gap-5 [&>*]:min-w-0">
        <AuthenticatedSection
          description={messageTranslate("admin.configuration.loginDescription")}
          title={messageTranslate("admin.configuration.loginTitle")}
        >
          <form
            class="grid gap-4 px-5 py-4 [&_label]:text-[0.8125rem]"
            onSubmit={(event) => {
              event.preventDefault()
              if (!props.canEdit) return
              void props.screen.policySubmit(event)
            }}
          >
            <div class="grid items-start gap-2 sm:grid-cols-2">
              <For each={policyFields}>
                {(field) => (
                  <label
                    class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 rounded-control border border-line-subtle px-3 py-3 text-[0.8125rem] font-medium"
                    for={`configuration-policy-${field.key}`}
                  >
                    <input
                      checked={policy()[field.key] ?? false}
                      class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                      disabled={!props.canEdit}
                      id={`configuration-policy-${field.key}`}
                      onChange={() => props.screen.policyToggle(field.key)}
                      type="checkbox"
                    />
                    <span class="min-w-0">{messageTranslate(field.labelKey)}</span>
                    <Show
                      when={
                        props.screen.securityPolicy === undefined &&
                        (props.page.overrides()[field.key] === undefined || props.page.overrides()[field.key] === null)
                      }
                    >
                      <span class="col-start-2">
                        <AuthenticatedStatus
                          label={messageTranslate("admin.organizations.policy.inherited")}
                          tone="neutral"
                        />
                      </span>
                    </Show>
                  </label>
                )}
              </For>
            </div>
            <div class="grid min-w-0 gap-1.5">
              <Label class="text-[0.8125rem] font-medium" for="configuration-policy-session-lifetime">
                {messageTranslate("admin.organizations.policy.sessionLifetime")}
              </Label>
              <AuthenticatedInput
                disabled={!props.canEdit}
                id="configuration-policy-session-lifetime"
                inputMode="numeric"
                max={31536000}
                min={1}
                onInput={(event) => props.screen.policySessionLifetimeSet(event.currentTarget.value)}
                type="number"
                value={policy().sessionLifetimeSeconds ?? ""}
              />
              <p class="text-xs text-muted-foreground">
                {messageTranslate("admin.organizations.policy.sessionLifetimeHint")}
              </p>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <For each={policyMfaLifetimeFields}>
                {(field) => (
                  <div class="grid min-w-0 content-start gap-1.5">
                    <Label class="text-[0.8125rem] font-medium" for={`configuration-policy-${field.key}`}>
                      {messageTranslate(field.labelKey)}
                    </Label>
                    <AuthenticatedInput
                      disabled={!props.canEdit}
                      id={`configuration-policy-${field.key}`}
                      inputMode="numeric"
                      max={31536000}
                      min={1}
                      onInput={(event) => props.screen.policyLifetimeSet(field.key, event.currentTarget.value)}
                      type="number"
                      value={policy()[field.key] ?? ""}
                    />
                  </div>
                )}
              </For>
            </div>
            <p class="text-xs text-muted-foreground">
              {messageTranslate("admin.organizations.policy.lifetimeUnsetHint")}
            </p>
            <Show when={props.page.providers().length > 0 || props.screen.policyDraft().providerIds != null}>
              <div class="grid min-w-0 gap-2">
                <p class="text-[0.8125rem] font-medium">
                  {messageTranslate("admin.organizations.policy.providerAllowlist")}
                </p>
                <p class="text-xs text-muted-foreground">
                  {messageTranslate("admin.organizations.policy.providerAllowlistDescription")}
                </p>
                <div class="grid items-start gap-2 sm:grid-cols-2">
                  <For each={props.page.providers()}>
                    {(provider) => (
                      <label
                        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 rounded-control border border-line-subtle px-3 py-3 text-[0.8125rem] font-medium"
                        for={`configuration-policy-provider-${provider.id}`}
                      >
                        <input
                          checked={(() => {
                            const allowlisted = policy().providerIds
                            return allowlisted == null ? true : allowlisted.includes(provider.id)
                          })()}
                          class={`${authenticatedControlClasses.checkbox} mt-0.5`}
                          disabled={!props.canEdit}
                          id={`configuration-policy-provider-${provider.id}`}
                          onChange={() => props.screen.policyProviderAllowlistToggle(provider.id)}
                          type="checkbox"
                        />
                        <span class="min-w-0 truncate" title={provider.displayName}>
                          {provider.displayName}
                        </span>
                      </label>
                    )}
                  </For>
                </div>
                <Show
                  when={(policy().providerIds ?? []).some(
                    (id) => !props.page.providers().some((provider) => provider.id === id),
                  )}
                >
                  <div class="flex flex-wrap gap-1.5">
                    <For
                      each={(policy().providerIds ?? []).filter(
                        (id) => !props.page.providers().some((provider) => provider.id === id),
                      )}
                    >
                      {(id) => (
                        <span class="inline-flex min-w-0 items-center gap-1.5 rounded-control border border-line-subtle px-2 py-1 text-xs">
                          <span class="min-w-0 truncate" title={id}>
                            {id}
                          </span>
                          <button
                            aria-label={messageTranslate("common.remove")}
                            class="text-muted-foreground hover:text-foreground"
                            disabled={!props.canEdit}
                            onClick={() => props.screen.policyProviderAllowlistToggle(id)}
                            type="button"
                          >
                            <Icon path={mdiCancel} class="size-3.5" />
                          </button>
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={props.canEdit && props.screen.policyDraft().providerIds != null}>
                  <div>
                    <AuthenticatedButton
                      onClick={props.screen.policyProviderAllowlistReset}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {messageTranslate("admin.organizations.policy.providerAllowlistReset")}
                    </AuthenticatedButton>
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={props.canEdit}>
              <div class="flex justify-end">
                <AuthenticatedButton
                  disabled={props.page.pendingId() === "policy"}
                  icon={mdiContentSave}
                  type="submit"
                  variant="filledBlue"
                >
                  {messageTranslate("common.save")}
                </AuthenticatedButton>
              </div>
            </Show>
          </form>
        </AuthenticatedSection>

        <OrganizationAdminSecurityPolicyView
          allowedFactors={props.screen.securityPolicy.effectiveAllowedFactors()}
          assurance={props.screen.securityPolicy.effectiveMinimumStepUpAssurance()}
          fieldInherited={props.screen.securityPolicy.fieldInherited}
          onAllowedFactorToggle={(factor) => props.canEdit && props.screen.securityPolicy.allowedFactorToggle(factor)}
          onAssuranceInput={(value) => props.canEdit && props.screen.securityPolicy.minimumStepUpAssuranceSet(value)}
          onFieldOverrideSet={(key, overridden) =>
            props.canEdit && props.screen.securityPolicy.fieldOverrideSet(key, overridden)
          }
          onPreferredFactorMove={(factor, direction) =>
            props.canEdit && props.screen.securityPolicy.preferredFactorMove(factor, direction)
          }
          onRequiredMfaInput={(value) => props.canEdit && props.screen.securityPolicy.requiredMfaSet(value)}
          order={props.screen.securityPolicy.effectivePreferredFactorOrder()}
          requiredMfa={props.screen.securityPolicy.effectiveRequiredMfa()}
          scope={props.screen.policyScope()}
          validationMessage={props.screen.policyValidationMessage()}
        />
      </div>
    </OrganizationAdminState>
  )
}
