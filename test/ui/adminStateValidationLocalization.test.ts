import { afterAll, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (effect: () => void) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [
  { i18nStore },
  { translationCsvParse },
  { organizationAdminFormStateCreate },
  { machineAdminListViewStateCreate },
  { machineAdminCredentialFormStateCreate },
  { oidcAdminClientListViewStateCreate },
] = await Promise.all([
  import("../../src/ui/i18n/model/i18nStore.js"),
  import("../../src/ui/i18n/model/translationCsvParse.js"),
  import("../../src/features/organizations/ui/organizationAdminFormStateCreate.js"),
  import("../../src/features/machineUsers/ui/machineAdminListViewStateCreate.js"),
  import("../../src/features/machineUsers/ui/machineAdminCredentialFormStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminClientListViewStateCreate.js"),
])

// The i18n store is global module state; restore the English default so file order never leaks.
afterAll(() => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
})

async function localeApply(locale: "ar" | "de"): Promise<Record<string, string>> {
  const parsed = translationCsvParse(await Bun.file(new URL(`../../public/i18n/${locale}.csv`, import.meta.url)).text())
  expect(parsed.success).toBe(true)
  if (!parsed.success) throw new Error(locale)
  i18nStore.language.set(locale)
  i18nStore.dictionary.set(parsed.data)
  return parsed.data
}

test("organization administration validation renders typed keys in English, German, and Arabic", async () => {
  i18nStore.language.set("en")
  i18nStore.dictionary.set({})
  const form = organizationAdminFormStateCreate()

  expect(form.validateOrganizationName("")).toBe(false)
  expect(form.validationMessage.get()).toBe("Enter an organization name.")
  expect(form.validateOrganizationName("Acme")).toBe(true)
  expect(form.validationMessage.get()).toBeUndefined()

  for (const locale of ["de", "ar"] as const) {
    const dictionary = await localeApply(locale)
    form.validateOrganizationName("")
    expect(form.validationMessage.get(), locale).toBe(dictionary["admin.organizations.list.nameRequired"])

    form.invitationEmail.set("not-an-email")
    expect(form.validateInvitation()).toBe(false)
    expect(form.validationMessage.get(), locale).toBe(dictionary["admin.organizations.invitations.emailInvalid"])

    form.claimDomain.set("")
    expect(form.validateDomainClaim()).toBe(false)
    expect(form.validationMessage.get(), locale).toBe(dictionary["admin.organizations.domains.invalid"])

    form.membershipUserId.set("")
    expect(form.validateMembership()).toBe(false)
    expect(form.validationMessage.get(), locale).toBe(dictionary["admin.organizations.memberships.invalid"])

    expect(form.validateProviderCreate()).toBe(false)
    expect(form.validationMessage.get(), locale).toBe(dictionary["admin.organizations.providers.invalid"])
  }
})

test("machine-user and OIDC form errors render typed keys in German and Arabic", async () => {
  const page = {
    apiKeyCreate: async () => undefined,
    machineUserCreate: async () => undefined,
    machineUsers: () => [],
    now: () => Date.UTC(2026, 7, 21),
    personalAccessTokenCreate: async () => undefined,
  }
  const event = { preventDefault: () => undefined } as SubmitEvent

  for (const locale of ["de", "ar"] as const) {
    const dictionary = await localeApply(locale)

    const machineList = machineAdminListViewStateCreate({
      createOpen: () => true,
      createOpenSet: () => undefined,
      machineUserOpen: () => undefined,
      page: page as never,
      search: () => "",
      searchSet: () => undefined,
    })
    await machineList.createSubmit(event)
    expect(machineList.formError(), locale).toBe(dictionary["admin.machine.users.invalid"])

    const credentialForm = machineAdminCredentialFormStateCreate({
      kind: () => "api_key",
      machineUserId: () => "machine-user-id",
      onIssued: () => undefined,
      page: page as never,
    })
    await credentialForm.submit(event)
    expect(credentialForm.formError(), locale).toBe(dictionary["admin.machine.credentials.nameRequired"])

    credentialForm.name.set("Deployment key")
    credentialForm.expiresAt.set("not-a-date")
    await credentialForm.submit(event)
    expect(credentialForm.formError(), locale).toBe(dictionary["admin.machine.credentials.expiryInvalid"])

    credentialForm.expiresAt.set("2020-01-01T00:00:00.000Z")
    await credentialForm.submit(event)
    expect(credentialForm.formError(), locale).toBe(dictionary["admin.machine.credentials.expiryPast"])

    const clientList = oidcAdminClientListViewStateCreate({
      clientOpen: () => undefined,
      createOpen: () => true,
      createOpenSet: () => undefined,
      page: { clients: () => [], clientCreate: async () => undefined } as never,
      search: () => "",
      searchSet: () => undefined,
    })
    await clientList.createSubmit(event)
    expect(clientList.formError(), locale).toBe(dictionary["admin.oidc.clients.invalid"])
  }
})
