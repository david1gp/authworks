import { expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import ts from "typescript"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import { languagesSupported } from "../../../ui/i18n/model/languagesSupported.js"
import { translationCsvParse } from "../../../ui/i18n/model/translationCsvParse.js"
import type { ExternalIdentityProvider } from "../../externalIdentities/public/externalIdentityProviderSchema.js"
import type { ExternalIdentity } from "../../externalIdentities/public/externalIdentitySchema.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

let location = { hash: "#security", pathname: "/demo/account", search: "" }
let navigate: (to: string, options: { replace?: boolean; scroll?: boolean }) => void
mock.module("@solidjs/router", () => ({
  useLocation: () => location,
  useNavigate: () => navigate,
}))

const { accountIdentitiesSectionStateCreate } = await import("./accountIdentitiesSectionStateCreate.js")

const identityCreate = (id: string, providerId = "github"): ExternalIdentity => ({
  createdAt: 1,
  email: `${id}@example.com`,
  emailVerified: true,
  externalSubject: `subject-${id}`,
  id,
  providerId,
  providerType: "github",
  realmId: "realm",
  updatedAt: 1,
  userId: "user",
  version: 1,
})
const providerCreate = (id: string, enabled = true): ExternalIdentityProvider => ({
  allowAccountCreation: true,
  clientId: `client-${id}`,
  createdAt: 1,
  displayName: `${id} provider`,
  enabled,
  id,
  realmId: "realm",
  redirectUri: "https://auth.example.com/callback",
  scopes: [],
  type: "github",
  updatedAt: 1,
  version: 1,
})

function fixtureCreate(initialSearch = "?fixture=empty") {
  const search = createSignalObject(initialSearch)
  const identities = createSignalObject<ExternalIdentity[]>([identityCreate("one"), identityCreate("two")])
  const providers = createSignalObject([
    providerCreate("github"),
    providerCreate("google"),
    providerCreate("off", false),
  ])
  const confirmation = createSignalObject<ReturnType<AccountSecurityViewState["identityLinkConfirmation"]>>(undefined)
  const linkProvider = createSignalObject<string | undefined>(undefined)
  const pending = createSignalObject<string | undefined>(undefined)
  const error = createSignalObject<string | undefined>(undefined)
  const linkConfirm = mock(async () => {
    confirmation.set(undefined)
    linkProvider.set(undefined)
  })
  const linkCancel = mock(() => {
    confirmation.set(undefined)
    linkProvider.set(undefined)
  })
  const navigations: { to: string; options: { replace?: boolean; scroll?: boolean } }[] = []
  location = {
    hash: "#security",
    pathname: "/demo/account",
    get search() {
      return search.get()
    },
  }
  navigate = (to, options) => {
    navigations.push({ to, options })
    search.set(new URL(to, "https://auth.example.com").search)
  }
  const security = {
    error: error.get,
    identities: identities.get,
    identityLinkCancel: linkCancel,
    identityLinkConfirm: linkConfirm,
    identityLinkConfirmation: confirmation.get,
    identityLinkProvider: linkProvider.get,
    identityProviderLinked: (id: string) => identities.get().some((identity) => identity.providerId === id),
    identityProviders: providers.get,
    pendingId: pending.get,
  }
  return {
    confirmation,
    error,
    identities,
    linkCancel,
    linkConfirm,
    linkProvider,
    navigations,
    pending,
    providers,
    search,
    security,
    state: accountIdentitiesSectionStateCreate(() => security),
  }
}

test("linked identity summary updates its count and status without changing account data", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate()
    expect(fixture.state.summaryValue()).toBe("2 linked identities")
    expect(fixture.state.summaryStatus()).toBe("Configured")
    expect(fixture.state.summaryTone()).toBe("success")
    fixture.identities.set([])
    expect(fixture.state.summaryValue()).toBe("0 linked identities")
    expect(fixture.state.summaryStatus()).toBe("Not configured")
    expect(fixture.state.summaryTone()).toBe("neutral")
    expect(fixture.linkConfirm).not.toHaveBeenCalled()
    expect(fixture.linkCancel).not.toHaveBeenCalled()
    dispose()
  })
})

test("identity dialogs select individual accounts and preserve unrelated query state and the section anchor", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate()
    expect(fixture.state.dialogOpen("one")).toBe(false)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    fixture.state.dialogOpenChange("one", true)
    expect(fixture.state.dialogOpen("one")).toBe(true)
    expect(fixture.state.dialogOpen("two")).toBe(false)
    fixture.state.dialogOpenChange("two", true)
    expect(fixture.state.dialogOpen("one")).toBe(false)
    expect(fixture.state.dialogOpen("two")).toBe(true)
    fixture.state.dialogOpenChange("one", false)
    expect(fixture.state.dialogOpen("two")).toBe(true)
    fixture.state.linkDialogOpenChange(true)
    expect(fixture.state.dialogOpen("two")).toBe(false)
    expect(fixture.state.linkDialogOpen()).toBe(true)
    fixture.state.dialogOpenChange("one", true)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    fixture.identities.set([identityCreate("two")])
    expect(fixture.state.dialogOpen("one")).toBe(false)
    fixture.state.dialogOpenChange("one", false)
    expect(fixture.search.get()).toBe("?fixture=empty")
    expect(
      fixture.navigations.every(({ to, options }) => to.endsWith("#security") && options.replace && !options.scroll),
    ).toBe(true)
    expect(fixture.linkConfirm).not.toHaveBeenCalled()
    expect(fixture.linkCancel).not.toHaveBeenCalled()
    dispose()
  })
})

test("URL dialog selections are validated, reloadable, and never create unsupported link capabilities", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate("?accountIdentity=two")
    expect(fixture.state.dialogOpen("two")).toBe(true)
    fixture.search.set("?accountIdentity=&accountIdentityLink=invalid")
    expect(fixture.state.dialogOpen("one")).toBe(false)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    expect(fixture.state.availableProviders().map((provider) => provider.id)).toEqual(["google"])
    fixture.providers.set([providerCreate("github"), providerCreate("off", false)])
    fixture.search.set("?accountIdentityLink=open")
    expect(fixture.state.linkAvailable()).toBe(false)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    fixture.state.linkDialogOpenChange(true)
    expect(fixture.navigations).toHaveLength(0)
    fixture.providers.set([])
    expect(fixture.state.linkAvailable()).toBe(false)
    fixture.linkProvider.set("github")
    expect(fixture.state.linkAvailable()).toBe(true)
    expect(fixture.state.linkDialogOpen()).toBe(true)
    dispose()
  })
})

test("identity dialog labels resolve provider names and retain every existing account-value fallback", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate()
    const identity = identityCreate("one")
    expect(fixture.state.identityTitle(identity)).toBe("Manage github provider account (one@example.com)")
    fixture.providers.set([])
    expect(fixture.state.identityLabel(identity)).toBe("github")
    expect(fixture.state.identityValue({ ...identity, email: undefined, username: "username" })).toBe("username")
    expect(fixture.state.identityValue({ ...identity, email: undefined, displayName: "Display name" })).toBe(
      "Display name",
    )
    expect(fixture.state.identityValue({ ...identity, email: undefined })).toBe("subject-one")
    dispose()
  })
})

test("provider callbacks reopen a hidden link dialog without confirming, and closing preserves the popup flow", async () => {
  await createRoot(async (dispose) => {
    const fixture = fixtureCreate()
    await Promise.resolve()
    fixture.linkProvider.set("google")
    fixture.pending.set("identity:link:google")
    fixture.state.linkDialogOpenChange(true)
    fixture.state.linkDialogOpenChange(false)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    expect(fixture.linkCancel).not.toHaveBeenCalled()
    fixture.pending.set(undefined)
    fixture.confirmation.set({ kind: "link_confirmation", confirmationToken: "private-token", expiresAt: 100 })
    expect(fixture.state.linkDialogOpen()).toBe(true)
    expect(fixture.state.linkProviderLabel()).toBe("google provider")
    expect(fixture.search.get()).not.toContain("private-token")
    expect(fixture.linkConfirm).not.toHaveBeenCalled()
    fixture.state.linkDialogOpenChange(false)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    expect(fixture.confirmation.get()).toBeDefined()
    fixture.state.linkDialogOpenChange(true)
    fixture.state.linkCancel()
    expect(fixture.linkCancel).toHaveBeenCalledTimes(1)
    expect(fixture.state.linkDialogOpen()).toBe(false)
    expect(fixture.confirmation.get()).toBeUndefined()
    dispose()
  })
})

test("explicit link confirmation retains failures, blocks duplicate pending controls, and closes only after success", async () => {
  await createRoot(async (dispose) => {
    const fixture = fixtureCreate()
    await Promise.resolve()
    fixture.linkProvider.set("google")
    fixture.confirmation.set({ kind: "link_confirmation", confirmationToken: "private-token", expiresAt: 100 })
    fixture.linkConfirm.mockImplementation(async () => {
      fixture.error.set("Provider rejected the link")
    })
    await fixture.state.linkConfirm()
    expect(fixture.state.linkDialogOpen()).toBe(true)
    expect(fixture.confirmation.get()).toBeDefined()
    fixture.pending.set("identity:link:confirm")
    fixture.state.linkDialogOpenChange(false)
    await fixture.state.linkConfirm()
    fixture.state.linkCancel()
    expect(fixture.state.linkDialogOpen()).toBe(true)
    expect(fixture.linkConfirm).toHaveBeenCalledTimes(1)
    expect(fixture.linkCancel).not.toHaveBeenCalled()
    fixture.pending.set(undefined)
    fixture.linkConfirm.mockImplementation(async () => {
      fixture.error.set(undefined)
      fixture.identities.set([...fixture.identities.get(), identityCreate("new", "google")])
      fixture.confirmation.set(undefined)
      fixture.linkProvider.set(undefined)
    })
    await fixture.state.linkConfirm()
    expect(fixture.state.linkDialogOpen()).toBe(false)
    expect(fixture.state.count()).toBe(3)
    expect(fixture.search.get()).toBe("?fixture=empty")
    dispose()
  })
})

test("linked identity rows are labelled dialogs, help stays in the collapsed card body, and every mutation is dialog-only", async () => {
  const source = await Bun.file(new URL("./AccountIdentitiesSection.tsx", import.meta.url)).text()
  const tree = ts.createSourceFile(
    "AccountIdentitiesSection.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const elements: ts.JsxElement[] = []
  const actions: ts.JsxAttribute[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) elements.push(node)
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onClick") actions.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  const name = (element: ts.JsxElement) => element.openingElement.tagName.getText(tree)
  const ancestor = (node: ts.Node, tag: string): ts.JsxElement | undefined => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) && name(parent) === tag) return parent
    }
    return undefined
  }
  const card = elements.find((element) => name(element) === "AccountDisclosure")
  expect(card).toBeDefined()
  expect(card?.openingElement.getText(tree)).toContain('summary={messageTranslate("shell.nav.linkedIdentities")}')
  expect(card?.openingElement.getText(tree)).toContain("status={state.summaryStatus()}")
  expect(card?.openingElement.getText(tree)).toContain("value={state.summaryValue()}")
  expect(card?.openingElement.getText(tree)).not.toContain("account.identities.description")
  expect(card?.getText(tree)).toContain('messageTranslate("account.identities.description")')
  const dialogs = elements.filter((element) => name(element) === "AuthenticatedDialog")
  expect(dialogs).toHaveLength(2)
  expect(dialogs[0]?.openingElement.getText(tree)).toContain("title={state.identityTitle(identity)}")
  expect(dialogs[0]?.openingElement.getText(tree)).toContain("open={state.dialogOpen(identity.id)}")
  expect(dialogs[1]?.openingElement.getText(tree)).toContain(
    'triggerLabel={messageTranslate("account.identities.linkTitle")}',
  )
  expect(ancestor(dialogs[1]!, "ul")).toBeDefined()
  expect(ancestor(dialogs[1]!, "Show")?.openingElement.getText(tree)).toContain("when={state.linkAvailable()}")
  const list = ancestor(dialogs[1]!, "ul")!
  const rows = list.children.filter((child) => ts.isJsxElement(child))
  expect(rows.at(-1)).toBe(ancestor(dialogs[1]!, "Show"))
  expect(actions.map((action) => action.initializer?.getText(tree))).toEqual([
    "{() => props.state.identityUnlink(identity.providerId, identity.externalSubject)}",
    "{() => props.state.identityLinkStart(provider.id)}",
    "{state.linkConfirm}",
    "{state.linkCancel}",
  ])
  for (const action of actions) expect(ancestor(action, "AuthenticatedDialog")).toBeDefined()
})

test("linked identity dialog copy exists in every supported locale with intact account and provider placeholders", async () => {
  const keys = ["account.identities.connecting", "account.identities.manage"] as const
  for (const language of languagesSupported.filter((language) => language.code !== "en")) {
    const csv = await Bun.file(new URL(`../../../../public/i18n/${language.code}.csv`, import.meta.url)).text()
    const parsed = translationCsvParse(csv)
    expect(parsed.success).toBe(true)
    if (!parsed.success) continue
    for (const key of keys) {
      expect(parsed.data[key]).toBeTruthy()
      expect((parsed.data[key]?.match(/\{\w+\}/g) ?? []).sort()).toEqual(
        (englishCatalog[key].match(/\{\w+\}/g) ?? []).sort(),
      )
    }
  }
})
