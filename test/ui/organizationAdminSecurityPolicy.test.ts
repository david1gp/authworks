import { describe, expect, mock, test } from "bun:test"
import type { MfaPolicyFactor } from "../../src/features/mfa/public/mfaPolicyFactorSchema.js"
import { organizationAdminSecurityPolicyValidate } from "../../src/features/organizations/ui/organizationAdminSecurityPolicyValidate.js"
import type { OrganizationLoginPolicy } from "../../src/features/organizations/public/organizationLoginPolicySchema.js"

mock.module("solid-js", () => ({
  createEffect: (effect: () => void) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_source: () => unknown, effect: () => void) => effect,
}))

const { organizationAdminSecurityPolicyDraftCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminSecurityPolicyDraftCreate.js"
)

const realmPolicy: OrganizationLoginPolicy = {
  allowDomainDiscovery: true,
  allowEmailOtp: true,
  allowExternalIdentity: true,
  allowExternalIdentityAutoLinking: true,
  allowPasskey: true,
  allowPassword: true,
  allowPasswordRecovery: true,
  allowRegistration: true,
  allowedFactors: ["totp", "email_otp", "passkey"],
  minimumStepUpAssurance: "multi_factor",
  preferredFactorOrder: ["totp", "email_otp", "passkey"],
  providerIds: null,
  requiredMfa: true,
}

describe("organization administration security policy state validation", () => {
  test("accepts inherited organization security values", () => {
    expect(organizationAdminSecurityPolicyValidate({ draft: {}, realmPolicy, scope: "organization" })).toBeUndefined()
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { allowedFactors: ["totp", "passkey"] },
        realmPolicy,
        scope: "organization",
      }),
    ).toBeUndefined()
  })

  test("rejects organization overrides that weaken realm requirements", () => {
    expect(
      organizationAdminSecurityPolicyValidate({ draft: { requiredMfa: false }, realmPolicy, scope: "organization" }),
    ).toBe("admin.organizations.policy.validation.requiredMfaWeaker")
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { minimumStepUpAssurance: "authenticated" },
        realmPolicy,
        scope: "organization",
      }),
    ).toBe("admin.organizations.policy.validation.assuranceWeaker")
  })

  test("rejects empty required factors and order entries outside the allowlist", () => {
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { allowedFactors: [] },
        realmPolicy,
        scope: "organization",
      }),
    ).toBe("admin.organizations.policy.validation.requiredFactors")
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { allowedFactors: ["totp"], preferredFactorOrder: ["passkey"] },
        realmPolicy,
        scope: "organization",
      }),
    ).toBe("admin.organizations.policy.validation.order")
  })

  test("rejects organization factors outside the realm allowlist", () => {
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { allowedFactors: ["email_otp"] },
        realmPolicy: { ...realmPolicy, allowedFactors: ["totp", "passkey"] },
        scope: "organization",
      }),
    ).toBe("admin.organizations.policy.validation.factorNarrowing")
  })

  test("validates unknown and duplicate factor arrays through the canonical schema", () => {
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { allowedFactors: ["unknown"] as unknown as MfaPolicyFactor[] },
        realmPolicy,
        scope: "realm",
      }),
    ).toBe("admin.organizations.policy.validation.order")
    expect(
      organizationAdminSecurityPolicyValidate({
        draft: { preferredFactorOrder: ["totp", "totp"] },
        realmPolicy,
        scope: "realm",
      }),
    ).toBe("admin.organizations.policy.validation.order")
  })

  test("preserves dirty drafts across refreshes and clears them on reset", () => {
    let effectivePolicy = realmPolicy
    const state = organizationAdminSecurityPolicyDraftCreate({
      effectivePolicy: () => effectivePolicy,
      overrides: () => ({}),
      realmPolicy: () => effectivePolicy,
      scope: () => "realm",
    })
    state.requiredMfaSet(false)
    effectivePolicy = { ...realmPolicy, requiredMfa: true }
    state.sourceRefresh()
    expect(state.draft().requiredMfa).toBe(false)
    expect(state.dirty()).toBe(true)

    state.draftReset()
    expect(state.draft().requiredMfa).toBe(true)
    expect(state.dirty()).toBe(false)
  })

  test("reconciles an overridden preferred order when a factor is removed", () => {
    const state = organizationAdminSecurityPolicyDraftCreate({
      effectivePolicy: () => realmPolicy,
      overrides: () => ({
        allowedFactors: ["totp", "passkey"],
        preferredFactorOrder: ["passkey", "totp"],
      }),
      realmPolicy: () => realmPolicy,
      scope: () => "organization",
    })
    state.allowedFactorToggle("passkey")
    expect(state.draft().allowedFactors).toEqual(["totp"])
    expect(state.draft().preferredFactorOrder).toEqual(["totp"])
    expect(state.validationKey()).toBeUndefined()
  })
})
