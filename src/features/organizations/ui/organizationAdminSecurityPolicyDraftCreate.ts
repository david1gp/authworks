import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { MfaPolicyFactor } from "../../mfa/public/mfaPolicyFactorSchema.js"
import type { OrganizationLoginPolicyAssurance } from "../public/organizationLoginPolicyAssuranceSchema.js"
import type { OrganizationLoginPolicyOverride } from "../public/organizationLoginPolicyOverrideSchema.js"
import type { OrganizationLoginPolicy } from "../public/organizationLoginPolicySchema.js"
import { organizationAdminSecurityPolicyValidate } from "./organizationAdminSecurityPolicyValidate.js"

type SecurityPolicyKey = "allowedFactors" | "minimumStepUpAssurance" | "preferredFactorOrder" | "requiredMfa"

export function organizationAdminSecurityPolicyDraftCreate(options: {
  readonly effectivePolicy: () => OrganizationLoginPolicy
  readonly overrides: () => OrganizationLoginPolicyOverride
  readonly realmPolicy: () => OrganizationLoginPolicy
  readonly scope: () => "organization" | "realm"
}) {
  const draft = createSignalObject<OrganizationLoginPolicyOverride>({})
  const dirty = createSignalObject(false)
  let loadedScope = options.scope()
  const sourceLoad = () => {
    const loaded = options.scope() === "realm" ? options.effectivePolicy() : options.overrides()
    draft.set({
      allowedFactors: loaded.allowedFactors,
      minimumStepUpAssurance: loaded.minimumStepUpAssurance,
      preferredFactorOrder: loaded.preferredFactorOrder,
      requiredMfa: loaded.requiredMfa,
    })
    dirty.set(false)
    loadedScope = options.scope()
  }
  const source = () =>
    JSON.stringify([options.scope(), options.effectivePolicy(), options.overrides(), options.realmPolicy()])
  const sourceRefresh = () => {
    if (dirty.get() && loadedScope === options.scope()) return
    sourceLoad()
  }

  createEffect(on(source, sourceRefresh))

  const effectiveValue = <Key extends SecurityPolicyKey>(key: Key): NonNullable<OrganizationLoginPolicyOverride[Key]> =>
    (draft.get()[key] ?? options.realmPolicy()[key]) as NonNullable<OrganizationLoginPolicyOverride[Key]>
  const fieldOverrideSet = (key: SecurityPolicyKey, overridden: boolean) => {
    draft.set({ ...draft.get(), [key]: overridden ? effectiveValue(key) : null })
    dirty.set(true)
  }

  return {
    allowedFactorToggle: (factor: MfaPolicyFactor) => {
      const current = effectiveValue("allowedFactors")
      draft.set({
        ...draft.get(),
        allowedFactors: current.includes(factor) ? current.filter((item) => item !== factor) : [...current, factor],
        preferredFactorOrder:
          draft.get().preferredFactorOrder == null
            ? draft.get().preferredFactorOrder
            : draft.get().preferredFactorOrder?.filter((item) => item !== factor || !current.includes(factor)),
      })
      dirty.set(true)
    },
    draft: draft.get,
    draftReset: sourceLoad,
    dirty: dirty.get,
    effectiveAllowedFactors: () => effectiveValue("allowedFactors"),
    effectiveMinimumStepUpAssurance: () => effectiveValue("minimumStepUpAssurance"),
    effectivePreferredFactorOrder: () => {
      const order = effectiveValue("preferredFactorOrder")
      if (options.scope() === "realm" || draft.get().preferredFactorOrder != null) return order
      const allowed = effectiveValue("allowedFactors")
      return order.filter((factor) => allowed.includes(factor))
    },
    effectiveRequiredMfa: () => effectiveValue("requiredMfa"),
    fieldInherited: (key: SecurityPolicyKey) => options.scope() === "organization" && draft.get()[key] == null,
    fieldOverrideSet,
    minimumStepUpAssuranceSet: (value: OrganizationLoginPolicyAssurance) => {
      draft.set({ ...draft.get(), minimumStepUpAssurance: value })
      dirty.set(true)
    },
    preferredFactorMove: (factor: MfaPolicyFactor, direction: -1 | 1) => {
      const current = [...effectiveValue("preferredFactorOrder")]
      const from = current.indexOf(factor)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.length) return
      ;[current[from], current[to]] = [current[to]!, current[from]!]
      draft.set({ ...draft.get(), preferredFactorOrder: current })
      dirty.set(true)
    },
    requiredMfaSet: (value: boolean) => {
      draft.set({ ...draft.get(), requiredMfa: value })
      dirty.set(true)
    },
    sourceRefresh,
    validationKey: () =>
      organizationAdminSecurityPolicyValidate({
        draft: draft.get(),
        realmPolicy: options.realmPolicy(),
        scope: options.scope(),
      }),
  }
}
