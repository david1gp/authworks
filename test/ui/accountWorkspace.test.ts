import { describe, expect, test } from "bun:test"
import { accountSectionNavStateCreate } from "../../src/features/account/ui/accountSectionNavStateCreate.js"
import { accountWorkspaceSectionIds } from "../../src/features/account/ui/accountWorkspaceSectionIds.js"

describe("account workspace", () => {
  test("keeps stable anchors for every workspace section", () => {
    expect(accountWorkspaceSectionIds).toEqual({
      access: "access",
      dangerZone: "danger-zone",
      devicesApplications: "devices-applications",
      profile: "profile",
      security: "security",
    })
    expect(new Set(Object.values(accountWorkspaceSectionIds)).size).toBe(5)
  })

  test("creates account section navigation items targeting workspace section anchors", () => {
    const state = accountSectionNavStateCreate(() => "")
    const items = state.items()
    expect(items.map((item) => item.id)).toEqual([
      accountWorkspaceSectionIds.profile,
      accountWorkspaceSectionIds.security,
      accountWorkspaceSectionIds.devicesApplications,
      accountWorkspaceSectionIds.access,
      accountWorkspaceSectionIds.dangerZone,
    ])
    expect(items.map((item) => item.href)).toEqual([
      `#${accountWorkspaceSectionIds.profile}`,
      `#${accountWorkspaceSectionIds.security}`,
      `#${accountWorkspaceSectionIds.devicesApplications}`,
      `#${accountWorkspaceSectionIds.access}`,
      `#${accountWorkspaceSectionIds.dangerZone}`,
    ])
    for (const item of items) {
      expect(item.icon.length).toBeGreaterThan(0)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  test("renders every section heading as a clickable permalink to its stable anchor", async () => {
    const heading = await Bun.file(
      new URL("../../src/features/account/ui/AccountSectionAnchorHeading.tsx", import.meta.url),
    ).text()

    expect(heading).toContain("href={`#${props.id}`}")
    expect(heading).toContain("id={`account-workspace-${props.id}-title`}")
    expect(heading).toContain("focus-visible:ring-2")

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()

    expect(workspace.match(/<AccountSectionAnchorHeading/g)).toHaveLength(5)
    for (const id of Object.values(accountWorkspaceSectionIds)) {
      expect(workspace).toContain("id={accountWorkspaceSectionIds.")
      expect(workspace).toContain(`aria-labelledby="account-workspace-${id}-title"`)
    }
  })

  test("renders the account section links in the primary navbar row without a secondary row", async () => {
    const shell = await Bun.file(
      new URL("../../src/ui/production/ProductionAuthenticatedShell.tsx", import.meta.url),
    ).text()

    expect(shell).not.toContain("AccountSectionNav")
    expect(shell).toContain("state.accountSections()")
    expect(shell).toContain("state.isAccountSectionActive(item.id)")
    // The links live inside the sticky header's primary row, not in a separate sticky nav below it.
    expect(shell).not.toContain("sticky top-12")
    expect(shell.indexOf("state.accountSections()")).toBeLessThan(shell.indexOf("</header>"))

    expect(
      await Bun.file(new URL("../../src/features/account/ui/AccountSectionNav.tsx", import.meta.url)).exists(),
    ).toBe(false)
  })

  test("tracks fragment navigation through the router location", async () => {
    const shellState = await Bun.file(
      new URL("../../src/ui/production/productionAuthenticatedShellStateCreate.ts", import.meta.url),
    ).text()

    expect(shellState).toContain("accountSectionNavStateCreate(() => location.hash)")
  })

  test("shares profile state between the identity and email adapters only", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain(
      'const profileState = accountProductionAdapterStateCreate(() => "email", { realmId: props.realmId })',
    )
    expect(source).toContain('<AccountProductionAdapter kind="overview" state={profileState} />')
    expect(source).toContain('<AccountProductionAdapter kind="email" state={profileState} />')
    expect(source.match(/state=\{profileState\}/g)).toHaveLength(2)
  })

  test("uses one organization selector and selected panel for the production and demo access compositions", async () => {
    const production = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()
    const demo = await Bun.file(
      new URL("../../src/features/account/ui/AccountAccessDemoAdapter.tsx", import.meta.url),
    ).text()
    const accessView = await Bun.file(
      new URL("../../src/features/account/ui/AccountOrganizationAccessView.tsx", import.meta.url),
    ).text()

    expect(production).toContain("<AccountOrganizationAccessProductionAdapter />")
    expect(production).not.toContain('screen="organizations"')
    expect(production).not.toContain('screen="effective-access"')
    expect(demo).toContain("<AccountOrganizationAccessDemoAdapter organizationState={state} />")
    expect(demo).not.toContain("<AccountOrganizationsView")
    expect(demo).not.toContain("<AccountEffectiveAccessView")
    expect(accessView).toContain("<AccountOrganizationSelector")
    expect(accessView).toContain("<AccountOrganizationPanel")
  })

  test("consolidates profile identity into one summary without a redundant sign-in card", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("<AccountProfileIdentityStrip")
    expect(source).not.toContain("account.profile.signInTitle")
    expect(source).not.toContain("account.profile.signInDescription")
  })

  test("renders personal information as one card with three responsive columns", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    // One personal-information card: names, preferences, and the picture are its three columns.
    expect(source.match(/<AuthenticatedSection/g)).toHaveLength(1)
    expect(source).toContain("sm:grid-cols-2 lg:grid-cols-3")
    expect(source).not.toContain("lg:grid-cols-12")
    expect(source).not.toContain('class="lg:col-span-8"')
    expect(source).toContain("<AccountProfilePictureField")

    // Column one is first name, last name, display name; column two is nickname, gender, language.
    const fieldOrder = [...source.matchAll(/account\.profile\.(firstName|lastName|displayName|nickName|gender)"/g)].map(
      ([, field]) => field,
    )
    expect(fieldOrder.slice(0, 5)).toEqual(["firstName", "lastName", "displayName", "nickName", "gender"])

    // The removed nickname helper copy must not come back.
    expect(source).not.toContain("nickNameHint")
  })

  test("gives the authenticated workspace a wider desktop container that still stacks on mobile", async () => {
    const shell = await Bun.file(
      new URL("../../src/ui/production/ProductionAuthenticatedShell.tsx", import.meta.url),
    ).text()

    expect(shell).toContain("max-w-[1760px]")
    expect(shell).not.toContain("max-w-[1400px]")
    expect(shell).toContain("px-4 py-4 sm:px-6")
  })

  test("keeps exactly one accessible upload target without a redundant visible file control", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfilePictureField.tsx", import.meta.url),
    ).text()

    // Exactly one native file input, visually hidden, removed from the tab order, and hidden from
    // the accessibility tree so it is not exposed as a second "Choose a picture file" button.
    expect(source.match(/type="file"/g)).toHaveLength(1)
    expect(source).toContain('class="sr-only"')
    expect(source).toContain("tabIndex={-1}")
    expect(source).toContain('aria-hidden="true"')
    expect(source).not.toMatch(/<input[^>]*aria-label/s)
    // The dropzone is the single keyboard-operable picker trigger.
    expect(source.match(/role="button"/g)).toHaveLength(1)
    expect(source.match(/onClick=\{state\.openFilePicker\}/g)).toHaveLength(1)
    expect(source).toContain("onKeyDown={state.onKeyDown}")
    expect(source).toContain("tabIndex={state.busy() ? -1 : 0}")
    // Replacement and removal states remain available.
    expect(source).toContain('messageTranslate("account.profile.pictureChange")')
    expect(source).toContain('messageTranslate("account.profile.pictureRemove")')
  })

  test("marks only the hash-targeted section as current", () => {
    let hash = "#security"
    const state = accountSectionNavStateCreate(() => hash)

    expect(state.isActive(accountWorkspaceSectionIds.profile)).toBe(false)
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(true)

    hash = "#danger-zone"
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(false)
    expect(state.isActive(accountWorkspaceSectionIds.dangerZone)).toBe(true)
  })

  test("marks Profile current when the account page has no hash", () => {
    const state = accountSectionNavStateCreate(() => "")

    expect(state.isActive(accountWorkspaceSectionIds.profile)).toBe(true)
    expect(state.isActive(accountWorkspaceSectionIds.security)).toBe(false)
  })

  test("renders a page-level Account heading without the removed shell header", async () => {
    const source = await Bun.file(new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url)).text()

    expect(source).toContain('<h1 class="text-xl font-semibold tracking-tight">')
    expect(source).toContain('messageTranslate("shell.nav.account")')
    expect(source).not.toContain("AuthenticatedPageHeader")
  })

  test("lists every authenticator enrollment with an active-only remove control beside a persistent add action", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountFactorsSection.tsx", import.meta.url),
    ).text()

    expect(source).toContain("const totpEnrollments = () => props.state.methods().totp.enrollments")
    expect(source).toContain("<For each={totpEnrollments()}>")
    expect(source).toContain("{enrollment.label}")
    expect(source).toContain('enrollment.status === "active"')
    expect(source).toContain("onClick={() => props.state.totpRemove(enrollment.id)}")
    // Pending enrollments cannot be removed by the backend, so no remove control is rendered for them.
    expect(source).toContain('<Show when={enrollment.status === "active"}>')
    // The add flow stays reachable regardless of how many enrollments already exist.
    expect(source).toContain("onClick={props.state.totpStart}")
    expect(source).not.toContain("totpEnrolled() ? props.state.totpRemove : props.state.totpStart")
  })

  test("splits every security identity area into an existing-entry and a new-entry card", async () => {
    const split = await Bun.file(
      new URL("../../src/features/account/ui/AccountSplitColumns.tsx", import.meta.url),
    ).text()

    // One shared two-column primitive: wide existing-entry column, narrow add column, stacked below lg.
    expect(split).toContain("lg:grid-cols-12")
    expect(split).toContain("lg:col-span-7")
    expect(split).toContain("lg:col-span-5")

    const sources = ["AccountPasskeysSection", "AccountFactorsSection", "AccountIdentitiesSection"]
    for (const name of sources) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()
      expect(source).toContain("<AccountSplitColumns")
      expect(source.match(/primary=\{/g)).toHaveLength(1)
      expect(source.match(/secondary=\{/g)).toHaveLength(1)
    }
  })

  test("keeps exactly one add control per security area without duplicating it across cards", async () => {
    const passkeys = await Bun.file(
      new URL("../../src/features/account/ui/AccountPasskeysSection.tsx", import.meta.url),
    ).text()
    expect(passkeys.match(/onClick=\{props\.state\.passkeyAdd\}/g)).toHaveLength(1)
    // The toolbar row is replaced by the add card, so the action is not rendered twice.
    expect(passkeys).not.toContain("AuthenticatedToolbar")
    expect(passkeys).toContain('messageTranslate("account.passkeys.empty")')

    const factors = await Bun.file(
      new URL("../../src/features/account/ui/AccountFactorsSection.tsx", import.meta.url),
    ).text()
    expect(factors.match(/onClick=\{props\.state\.totpStart\}/g)).toHaveLength(1)
    expect(factors).toContain("onClick={() => props.state.totpRemove(enrollment.id)}")

    const identities = await Bun.file(
      new URL("../../src/features/account/ui/AccountIdentitiesSection.tsx", import.meta.url),
    ).text()
    expect(identities.match(/onClick=\{\(\) => props\.state\.identityLinkStart\(provider\.id\)\}/g)).toHaveLength(1)
    expect(identities).toContain('messageTranslate("account.identities.empty")')

    const phone = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfilePhoneSection.tsx", import.meta.url),
    ).text()
    expect(phone.match(/onSubmit=\{props\.onStart\}/g)).toHaveLength(1)
    expect(phone).toContain('messageTranslate("account.profile.verificationPending")')

    const email = await Bun.file(
      new URL("../../src/features/account/ui/AccountEmailAddressView.tsx", import.meta.url),
    ).text()
    expect(email.match(/onSubmit=\{props\.onAddStart\}/g)).toHaveLength(1)
    expect(email.match(/onClick=\{\(\) => props\.onPrimarySet\(address\.id\)\}/g)).toHaveLength(1)
    expect(email.match(/onClick=\{\(\) => props\.onRemove\(address\.id\)\}/g)).toHaveLength(1)
  })

  test("renders contact methods as two list sections in one responsive grid with dialog-only add flows", async () => {
    const profile = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    // One parent grid: email addresses left, phone numbers right at desktop widths, stacked below lg.
    expect(profile).toContain("lg:grid-cols-2")
    expect(profile.indexOf("<AccountEmailAddressView")).toBeLessThan(profile.indexOf("<AccountProfilePhoneSection"))
    // The phone section is no longer a second, separately placed block further down the page.
    expect(profile.match(/<AccountProfilePhoneSection/g)).toHaveLength(1)
    expect(profile).not.toContain("AccountSplitColumns")

    for (const name of ["AccountEmailAddressView", "AccountProfilePhoneSection"]) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()

      // Exactly one add control per section, and it only opens an accessible dialog.
      expect(source.match(/<AuthenticatedDialog/g)).toHaveLength(1)
      expect(source).toContain("onOpenChange={props.onAddDialogOpenChange}")
      expect(source).toContain("open={props.addDialogOpen}")
      // Each section presents its data as a clean list.
      expect(source).toContain('class="divide-y divide-line-subtle"')
      expect(source).toContain("aria-label={messageTranslate(")
      // No always-visible add form outside the dialog.
      expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("<form"))
      expect(source).not.toContain("<ProductionStatePanel")
    }
  })

  test("removes the contact-method filler empty-state copy from the catalog", async () => {
    const catalog = await Bun.file(new URL("../../src/ui/i18n/model/englishCatalog.ts", import.meta.url)).text()

    expect(catalog).not.toContain("No verified phone number added")
    expect(catalog).not.toContain("account.profile.phoneNotAdded")
    expect(catalog).toContain('"account.profile.phoneNumbers": "Phone numbers"')
    expect(catalog).toContain('"account.profile.emailAddresses": "Email addresses"')
  })

  test("closing an add dialog abandons its in-flight contact-method challenge", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/accountPageStateCreate.ts", import.meta.url),
    ).text()

    expect(source).toContain("const emailAddDialogOpenSet = (open: boolean) => {")
    expect(source).toContain("if (!open) emailAddressAddCancel()")
    expect(source).toContain("const phoneAddDialogOpenSet = (open: boolean) => {")
    expect(source).toContain("phoneChangeCancel()")
    // A successful verification closes its dialog so the refreshed list is visible.
    expect(source).toContain('emailStatus.set("success")\n    emailAddDialogOpen.set(false)')
    expect(source).toContain('phoneStatus.set("success")\n    phoneAddDialogOpen.set(false)')
    // The emailed verification link reopens the dialog on its code step.
    expect(source).toContain("emailAddDialogOpen.set(true)")
  })

  test("keeps password status and action aligned while rendering the change form only in a dialog", async () => {
    const view = await Bun.file(
      new URL("../../src/features/account/ui/AccountPasswordView.tsx", import.meta.url),
    ).text()

    expect(view).toContain("sm:grid-cols-[minmax(0,1fr)_auto]")
    expect(view.match(/<AuthenticatedDialog/g)).toHaveLength(1)
    expect(view).toContain("onOpenChange={props.onDialogOpenChange}")
    expect(view).toContain("open={props.dialogOpen}")
    expect(view.indexOf("<AuthenticatedDialog")).toBeLessThan(view.indexOf("<form"))
    expect(view.indexOf('description={messageTranslate("account.password.description")}')).toBeGreaterThan(
      view.indexOf("<AuthenticatedDialog"),
    )

    const state = await Bun.file(
      new URL("../../src/features/account/ui/accountPageStateCreate.ts", import.meta.url),
    ).text()
    expect(state).toContain("const passwordDialogOpenSet = (open: boolean) => {")
    expect(state).toContain('currentPassword.set("")')
    expect(state).toContain('newPassword.set("")')
    expect(state).toContain('confirmPassword.set("")')
  })

  test("groups recent security activity with sessions and applications in one responsive grid", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain("lg:grid-cols-12")
    expect(source).toContain('class="lg:col-span-12"')
    expect(source).toContain('class="grid min-w-0 gap-3 lg:col-span-7 [&>*]:min-w-0"')
    expect(source).toContain('class="min-w-0 lg:col-span-5"')
    expect(source).toContain('<AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />')
    expect(source).toContain('<AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />')
    expect(source).toContain('<AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />')
    expect(source).toContain('<AccountAccessProductionAdapter screen="consents" />')

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()
    expect(workspace).toContain('messageTranslate("shell.nav.securityHistory")')
  })

  test("keeps activity, session state, and applications in a readable source order", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    const securityHistory = source.indexOf('screen="security-history"')
    const sessions = source.indexOf('screen="sessions"')
    const refreshTokens = source.indexOf('screen="refresh-tokens"')
    const consents = source.indexOf('screen="consents"')

    expect(securityHistory).toBeGreaterThan(-1)
    expect(sessions).toBeGreaterThan(securityHistory)
    expect(refreshTokens).toBeGreaterThan(sessions)
    expect(consents).toBeGreaterThan(refreshTokens)

    const historySource = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityHistorySection.tsx", import.meta.url),
    ).text()
    expect(historySource).toContain('title={messageTranslate("shell.nav.securityHistory")}')
    expect(historySource).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]")
    expect(historySource).toContain("onClick={props.state.securityHistoryLoadMore}")
    expect(historySource).not.toContain("account.securityHistory.description")
    expect(historySource).not.toContain("ProductionStatePanel")

    const sessionsSource = await Bun.file(
      new URL("../../src/features/account/ui/AccountSessionsSection.tsx", import.meta.url),
    ).text()
    expect(sessionsSource).toContain('title={messageTranslate("shell.nav.sessionsDevices")}')
    expect(sessionsSource).toContain("sm:grid-cols-[minmax(0,1fr)_auto]")
    expect(sessionsSource).toContain("onClick={() => props.state.sessionRevoke(session.id)}")
    expect(sessionsSource).not.toContain("ProductionStatePanel")

    const refreshTokensSource = await Bun.file(
      new URL("../../src/features/account/ui/AccountRefreshTokensSection.tsx", import.meta.url),
    ).text()
    expect(refreshTokensSource).toContain("onClick={props.state.refreshTokensRevokeAll}")
    expect(refreshTokensSource).toContain("onClick={() => props.state.refreshTokenRevoke(token.familyId)}")
    expect(refreshTokensSource).not.toContain("ProductionStatePanel")

    const consentsSource = await Bun.file(
      new URL("../../src/features/account/ui/AccountConsentsView.tsx", import.meta.url),
    ).text()
    expect(consentsSource).toContain('title={messageTranslate("shell.nav.applications")}')
    expect(consentsSource).toContain("sm:grid-cols-[minmax(0,1fr)_auto]")
    expect(consentsSource).toContain("onClick={() => props.onRevoke(consent.clientId)}")

    const catalog = await Bun.file(new URL("../../src/ui/i18n/model/englishCatalog.ts", import.meta.url)).text()
    expect(catalog).toContain('"shell.nav.securityHistory": "Recent security activity"')
    expect(catalog).not.toContain("Review recent security activity for this account")
  })

  test("renders effective access as outlined groups with responsive divided rows", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountEffectiveAccessView.tsx", import.meta.url),
    ).text()

    // Organizations use one fieldset-like outline; access sources are divided rows rather than nested cards.
    expect(source).toContain('<fieldset class="min-w-0 rounded-panel border border-line')
    expect(source).toContain("<legend")
    expect(source).toContain("divide-y divide-line-subtle")
    expect(source).toContain("md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")
    expect(source).not.toContain("AuthenticatedSection")

    // Permissions live inside a disclosure whose summary names its access source.
    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('messageTranslate("account.access.permissionsToggle", {')
    expect(source).toContain("source: source(),")
    expect(source).toContain('messageTranslate("account.access.effectivePermissions"')

    const disclosure = await Bun.file(
      new URL("../../src/features/account/ui/AccountDisclosure.tsx", import.meta.url),
    ).text()

    // A native details/summary pair is collapsed by default and keyboard-operable without script.
    expect(disclosure).toContain("<details")
    expect(disclosure).toContain("<summary")
    expect(disclosure).not.toContain("open")
    expect(disclosure).toContain("focus-visible:ring-2")
  })

  test("collapses the entire danger zone body while keeping its destructive confirmation", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountDeleteView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('summary={messageTranslate("account.delete.dangerZoneToggle")}')
    // The confirmation form is the disclosure body, so nothing destructive renders while collapsed.
    expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("onSubmit={props.onDelete}"))
    expect(source).toContain('messageTranslate("account.delete.confirmLabel"')
    expect(source).toContain('id="account-delete-confirmation"')
    expect(source).toContain('messageTranslate("account.delete.submit")')
    expect(source).toContain('variant="filledRed"')
  })

  test("points invitation organization switching to account access", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountAccessProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain('organizationsHref="/account#access"')
  })
})
