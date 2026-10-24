import { mdiContentSave } from "@adaptive-ds/mdi/mdiContentSave.js"
import { For, Show } from "solid-js"
import { AuthenticatedButton } from "../../../ui/authenticated/AuthenticatedButton.js"
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
>

const policyFields = [
  { key: "allowPassword", labelKey: "admin.organizations.policy.password" },
  { key: "allowPasswordRecovery", labelKey: "admin.organizations.policy.passwordRecovery" },
  { key: "allowPasskey", labelKey: "admin.organizations.policy.passkey" },
  { key: "allowEmailOtp", labelKey: "admin.organizations.policy.emailOtp" },
  { key: "allowExternalIdentity", labelKey: "admin.organizations.policy.externalIdentity" },
  { key: "allowRegistration", labelKey: "admin.organizations.policy.registration" },
  { key: "allowDomainDiscovery", labelKey: "admin.organizations.policy.domainDiscovery" },
] as const satisfies readonly { key: PolicyKey; labelKey: MessageKey }[]

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
                      checked={policy()[field.key]}
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
