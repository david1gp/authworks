import { describe, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"

mock.module("@solidjs/router", () => ({
  useLocation: () => ({ hash: "", pathname: "/account", search: "" }),
}))

import { accountSectionNavStateCreate } from "../../src/features/account/ui/accountSectionNavStateCreate.js"
import { accountWorkspaceSectionIds } from "../../src/features/account/ui/accountWorkspaceSectionIds.js"

const { productionAuthenticatedShellStateCreate } = await import(
  "../../src/ui/production/productionAuthenticatedShellStateCreate.js"
)

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

  test("offers an independent card summary with icon, value and status without changing workspace anchors", async () => {
    const disclosure = await Bun.file(
      new URL("../../src/features/account/ui/AccountDisclosure.tsx", import.meta.url),
    ).text()
    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()

    expect(disclosure).toContain('readonly variant: "card"')
    expect(disclosure).toContain("readonly icon: string")
    expect(disclosure).toContain("{props.summary}")
    expect(disclosure).toContain("{value()}")
    expect(disclosure).toContain("{status()}")
    expect(disclosure).toContain("group-open:rotate-180")
    expect(workspace).toContain("scroll-mt-24 gap-3 sm:gap-4")
    expect(workspace).toContain("gap-6 pb-8 sm:gap-8")
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
    expect(heading).not.toContain("description")

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()

    expect(workspace.match(/<AccountSectionAnchorHeading/g)).toHaveLength(5)
    expect(workspace).not.toContain("Description")
    expect(workspace).not.toContain("description=")
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

  test("shares profile and overview security state across the composed account page", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()
    const stateSource = await Bun.file(
      new URL("../../src/features/account/ui/accountWorkspaceProductionAdapterStateCreate.ts", import.meta.url),
    ).text()

    expect(source).toContain("const state = accountWorkspaceProductionAdapterStateCreate(() => props.realmId)")
    expect(source).toContain("securityProgress={state.securityProgress}")
    expect(source).toContain(
      '<AccountProductionAdapter kind="email" renderConfirmation={false} state={state.profile} />',
    )
    expect(source).toContain("state={state.security}")
    expect(stateSource).toContain('accountProductionAdapterStateCreate(() => "email"')
    expect(stateSource).toContain("accountSecurityProgressStateCreate({")
    expect(stateSource).toContain("methods: security.methods")
    expect(stateSource).toContain("passkeyCount: () => security.passkeys().length")
  })

  test("renders the demo landing page with the shared workspace and fixture-backed adapters", async () => {
    const screen = await Bun.file(
      new URL("../../src/features/account/ui/AccountDemoScreen.tsx", import.meta.url),
    ).text()
    const demoWorkspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceDemoAdapter.tsx", import.meta.url),
    ).text()
    const productionWorkspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(screen).toContain("<AccountWorkspaceDemoAdapter />")
    expect(demoWorkspace).toContain("<AccountWorkspace")
    expect(demoWorkspace).toContain('kind="overview"')
    expect(demoWorkspace).toContain('screen="overview"')
    expect(demoWorkspace).toContain('screen="organizations"')
    expect(demoWorkspace).toContain('screen="consents"')
    expect(demoWorkspace).toContain('screen="security-history"')
    expect(demoWorkspace).toContain('screen="sessions"')
    expect(demoWorkspace).toContain('screen="refresh-tokens"')
    expect(demoWorkspace).not.toContain("ProductionAdapter")
    expect(productionWorkspace).toContain("<AccountWorkspace")
    expect(demoWorkspace).toContain("AccountWorkspaceDevicesApplications")
    expect(productionWorkspace).toContain("AccountWorkspaceDevicesApplications")
    expect(demoWorkspace).toContain("AccountWorkspaceAccess")
    expect(productionWorkspace).toContain("AccountWorkspaceAccess")
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

  test("keeps all account organization destinations read-only without removing session APIs", async () => {
    const files = await Promise.all(
      [
        "AccountOrganizationAccessView",
        "AccountOrganizationPanel",
        "AccountOrganizationAccessDemoAdapter",
        "AccountOrganizationAccessProductionAdapter",
        "AccountAccessProductionAdapter",
        "AccountInvitationsView",
      ].map((name) => Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()),
    )
    const [view, panel, demo, production, destination, invitations] = files

    expect(view).toContain('variant="card"')
    expect(view).toContain("<AccountOrganizationSelector")
    expect(destination).toContain("<AccountOrganizationAccessProductionAdapter />")
    expect(invitations).toContain('messageTranslate("shell.nav.organizations")')
    for (const source of [view, panel, demo, production, destination, invitations]) {
      expect(source).not.toContain("organizationSwitch")
      expect(source).not.toContain("onOrganizationActivate")
      expect(source).not.toContain('messageTranslate("account.access.switchOrganization")')
      expect(source).not.toContain('messageTranslate("account.access.makeActiveOrganization")')
    }
  })

  test("consolidates profile identity into one summary without a redundant sign-in card", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("<AccountProfileIdentityStrip")
    expect(source).not.toContain("account.profile.signInTitle")
    expect(source).not.toContain("account.profile.signInDescription")
  })

  test("collapses identity and personal details independently while keeping editing inside a dialog", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileView.tsx", import.meta.url),
    ).text()
    const overview = await Bun.file(
      new URL("../../src/features/account/ui/AccountProfileIdentityStrip.tsx", import.meta.url),
    ).text()

    // Each summary carries a current value; details and edit controls stay inside the card body.
    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('variant="card"')
    expect(source).toContain('value={state.personalSummary() || messageTranslate("account.profile.notSet")}')
    expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.profile.personalDescription"))
    expect(source).toContain("sm:grid-cols-2 lg:grid-cols-3")
    expect(source).toContain("<dl")
    expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("<form"))
    expect(source).toContain("onOpenChange={props.onProfileDialogOpenChange}")
    expect(source).not.toContain("lg:grid-cols-12")
    expect(source).not.toContain('class="lg:col-span-8"')
    expect(source).not.toContain("<AuthenticatedToolbar")
    expect(source).not.toContain("<AccountProfilePictureField")
    const progress = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityProgress.tsx", import.meta.url),
    ).text()
    expect(overview).toContain("<AccountProfilePictureField")
    expect(overview).toContain("<AccountDisclosure")
    expect(overview).toContain('variant="card"')
    expect(overview.indexOf("<AccountDisclosure")).toBeLessThan(overview.indexOf("<AccountProfilePictureField"))
    expect(overview.indexOf("<AccountDisclosure")).toBeLessThan(overview.indexOf("account.profile.signInDescription"))
    expect(overview.match(/<AccountIdentityCopyButton/g)).toHaveLength(3)
    expect(overview).toContain("<AccountSecurityProgress state={props.securityProgress} />")
    expect(progress).toContain('href="#security"')
    expect(progress).toContain('messageTranslate("account.security.recoveryMfa")')
    expect(progress).toContain("{props.state.text()}")
    expect(progress).toContain('role="progressbar"')

    // The removed nickname helper copy must not come back.
    expect(source).not.toContain("nickNameHint")
    expect(source).toContain("mdiAccountDetailsOutline")
  })

  test("offers labeled icon-only identity copy controls with announced success and failure", async () => {
    const copy = await Bun.file(
      new URL("../../src/features/account/ui/AccountIdentityCopyButton.tsx", import.meta.url),
    ).text()
    expect(copy).toContain("<ButtonIconOnly")
    expect(copy).toContain('aria-label={messageTranslate("account.profile.copy"')
    expect(copy).toContain('aria-live="polite"')
    expect(copy).toContain('role="status"')
    expect(copy).toContain('messageTranslate("account.profile.copied"')
    expect(copy).toContain('messageTranslate("account.profile.copyFailed"')
  })

  test("gives the authenticated workspace a wider desktop container that still stacks on mobile", async () => {
    const shell = await Bun.file(
      new URL("../../src/ui/production/ProductionAuthenticatedShell.tsx", import.meta.url),
    ).text()

    expect(shell).toContain("max-w-[1760px]")
    expect(shell).not.toContain("max-w-[1400px]")
    expect(shell).toContain("px-4 py-4 sm:px-6")

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()
    expect(workspace).toContain("max-w-7xl")
  })

  test("stages picture selection inside an accessible dialog before saving", async () => {
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
    expect(source).toContain("<AuthenticatedDialog")
    expect(source).toContain("onOpenChange={state.openChange}")
    expect(source).toContain("onClick={state.save}")
    expect(source).toContain("state.previewUrl()")
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

  test("lists every authenticator enrollment as a dialog row and keeps add last", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountFactorsSection.tsx", import.meta.url),
    ).text()

    expect(source).toContain("const state = accountFactorsSectionStateCreate(() => props.state)")
    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('summary={messageTranslate("account.factors.authenticator")}')
    expect(source).toContain(
      'status={messageTranslate(state.enrolled() ? "account.factors.configured" : "account.factors.missing")}',
    )
    expect(source).toContain("statusIcon={state.enrolled() ? mdiCheckCircleOutline : mdiAlertCircleOutline}")
    expect(source).toContain('value={messageTranslate("account.factors.count", { count: state.enrollments().length })}')
    expect(source.indexOf("<AccountDisclosure")).toBeLessThan(source.indexOf("account.factors.description"))
    expect(source).toContain("<For each={state.enrollments()}>")
    expect(source).toContain("{enrollment.label}")
    expect(source).toContain('enrollment.status === "active"')
    expect(source).toContain("state.renameRemove(enrollment.id)")
    expect(source).toContain("title={enrollment.label}")
    expect(source.indexOf("<AuthenticatedDialog", source.indexOf("<For each={state.enrollments()}>"))).toBeLessThan(
      source.indexOf("state.renameRemove(enrollment.id)"),
    )
    // Pending enrollments open a detail dialog but never expose backend-unsupported mutations.
    expect(source).toContain('when={enrollment.status === "active"}')
    expect(source.indexOf("state.renameRemove(enrollment.id)")).toBeGreaterThan(source.indexOf("<form"))
    // The add flow stays reachable regardless of how many enrollments already exist, at the end of the list.
    expect(source.indexOf('triggerLabel={messageTranslate("account.factors.addTotp")}')).toBeGreaterThan(
      source.indexOf("</For>"),
    )
    expect(source.indexOf('triggerLabel={messageTranslate("account.factors.addTotp")}')).toBeLessThan(
      source.indexOf("</ul>"),
    )
    expect(source.match(/triggerLabel=\{messageTranslate\("account\.factors\.addTotp"\)\}/g)).toHaveLength(1)
    expect(source).toContain("<Show when={props.state.totpSetup()}>")
    expect(source.match(/<AuthenticatedDialog/g)).toHaveLength(3)
    const catalog = await Bun.file(new URL("../../src/ui/i18n/model/englishCatalog.ts", import.meta.url)).text()
    expect(catalog).toContain('"account.factors.authenticator": "Authenticator"')
    expect(catalog).toContain('"account.factors.configured": "Authenticator configured"')
    expect(catalog).toContain('"account.factors.missing": "Authenticator missing"')
  })

  test("keeps security data and actions inside five management cards", async () => {
    const sources = [
      "AccountPasskeysSection",
      "AccountFactorsSection",
      "AccountIdentitiesSection",
      "AccountPasswordSection",
      "AccountRecoveryCodesSection",
    ]
    for (const name of sources) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()
      expect(source.match(/<AuthenticatedSection|<AccountDisclosure/g)).toHaveLength(1)
      expect(source).not.toContain("AccountSplitColumns")
      expect(source).not.toContain("ProductionStatePanel")
    }

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()
    expect(workspace.match(/screen="overview"/g)).toHaveLength(1)
    expect(workspace).toContain('passwordAction={<AccountProductionAdapter kind="password" passwordActionOnly />}')
    expect(workspace).not.toContain('screen="passkeys"')
    expect(workspace).not.toContain('screen="factors"')
    expect(workspace).not.toContain('screen="recovery-codes"')
    expect(workspace).not.toContain('screen="identities"')
  })

  test("keeps exactly one add control per security area without duplicating it across cards", async () => {
    const passkeys = await Bun.file(
      new URL("../../src/features/account/ui/AccountPasskeysSection.tsx", import.meta.url),
    ).text()
    expect(passkeys.match(/onClick=\{props\.state\.passkeyAdd\}/g)).toHaveLength(1)
    // The add action lives in the cohesive card header and is not rendered twice.
    expect(passkeys).not.toContain("AuthenticatedToolbar")
    expect(passkeys).toContain('messageTranslate("account.passkeys.empty")')

    const factors = await Bun.file(
      new URL("../../src/features/account/ui/AccountFactorsSection.tsx", import.meta.url),
    ).text()
    expect(factors.match(/triggerLabel=\{messageTranslate\("account\.factors\.addTotp"\)\}/g)).toHaveLength(1)
    expect(factors).toContain("state.renameRemove(enrollment.id)")

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

  test("adds existing MDI icons to the refined account section headings", async () => {
    const expectedIcons = {
      AccountEmailAddressView: "mdiEmailOutline",
      AccountFactorsSection: "mdiCellphoneKey",
      AccountIdentitiesSection: "mdiLinkVariant",
      AccountPasskeysSection: "mdiFingerprint",
      AccountProfilePhoneSection: "mdiPhoneOutline",
      AccountRecoveryCodesSection: "mdiBackupRestore",
    }

    for (const [name, icon] of Object.entries(expectedIcons)) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()
      expect(source).toContain(`icon={${icon}}`)
    }
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
      expect(source.match(/<AuthenticatedDialog/g)).toHaveLength(name === "AccountEmailAddressView" ? 2 : 1)
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

  test("places activity and sessions in equal desktop columns with applications below", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()
    const groupedContent = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceDevicesApplications.tsx", import.meta.url),
    ).text()

    expect(groupedContent).toContain("lg:grid-cols-2")
    expect(groupedContent).toContain('class="min-w-0 lg:col-span-2"')
    expect(source).toContain(
      'activity={<AccountSecurityProductionAdapter realmId={props.realmId} screen="security-history" />}',
    )
    expect(source).toContain(
      'sessions={<AccountSecurityProductionAdapter realmId={props.realmId} screen="sessions" />}',
    )
    expect(source).toContain(
      'applications={<AccountSecurityProductionAdapter realmId={props.realmId} screen="refresh-tokens" />}',
    )
    expect(source).toContain('<AccountAccessProductionAdapter screen="consents" />')

    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()
    expect(workspace).toContain('messageTranslate("account.workspace.devicesTitle")')
  })

  test("keeps activity and sessions as independent sibling disclosures in both workspace adapters", async () => {
    const group = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceDevicesApplications.tsx", import.meta.url),
    ).text()
    const activity = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityHistorySection.tsx", import.meta.url),
    ).text()
    const sessions = await Bun.file(
      new URL("../../src/features/account/ui/AccountSessionsSection.tsx", import.meta.url),
    ).text()

    expect(group.indexOf("{props.activity}")).toBeLessThan(group.indexOf("{props.sessions}"))
    expect(group).not.toContain("<AccountDisclosure")
    expect(activity.match(/<AccountDisclosure/g)).toHaveLength(1)
    expect(sessions.match(/<AccountDisclosure/g)).toHaveLength(1)
    for (const adapter of ["AccountWorkspaceDemoAdapter", "AccountWorkspaceProductionAdapter"]) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${adapter}.tsx`, import.meta.url)).text()
      expect(source).toContain('screen="security-history"')
      expect(source).toContain('screen="sessions"')
    }
  })

  test("routes every account destructive action through the styled confirmation state", async () => {
    const stateSources = await Promise.all(
      ["accountPageStateCreate", "accountSecurityProductionStateCreate", "accountAccessProductionStateCreate"].map(
        (name) => Bun.file(new URL(`../../src/features/account/ui/${name}.ts`, import.meta.url)).text(),
      ),
    )
    for (const source of stateSources) {
      expect(source).toContain("confirmStateCreate()")
      expect(source).not.toContain("window.confirm")
    }

    expect(stateSources[0]).toContain('confirmation.confirm(messageTranslate("account.profile.pictureRemove"))')
    expect(stateSources[0]).toContain('confirmation.confirm(messageTranslate("account.profile.emailRemove"))')
    expect(stateSources[0]).toContain('confirmation.confirm(messageTranslate("account.profile.phoneChange"))')
    expect(stateSources[0]).toContain('confirmation.confirm(messageTranslate("account.delete.warning"))')
    expect(stateSources[1]).toContain('confirmation.confirm(messageTranslate("account.passkeys.remove"))')
    expect(stateSources[1]).toContain('confirmation.confirm(messageTranslate("account.factors.removeTotp"))')
    expect(stateSources[1]).toContain('confirmation.confirm(messageTranslate("account.identities.unlinkConfirm"))')
    expect(stateSources[1]).toContain('confirmation.confirm(messageTranslate("account.sessions.revokeConfirm"))')
    expect(stateSources[1]).toContain('confirmation.confirm(messageTranslate("account.refreshTokens.revokeConfirm"))')
    expect(stateSources[1]).toContain(
      'confirmation.confirm(messageTranslate("account.refreshTokens.revokeAllConfirm"))',
    )
    expect(stateSources[2]).toContain('confirmation.confirm(messageTranslate("account.access.consentRevokeConfirm"')
  })

  test("keeps activity, session state, and applications in a readable source order", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspaceProductionAdapter.tsx", import.meta.url),
    ).text()

    const securityHistory = source.indexOf('screen="security-history"')
    const sessions = source.indexOf('screen="sessions"')
    const refreshTokens = source.indexOf('screen="refresh-tokens"')

    expect(securityHistory).toBeGreaterThan(-1)
    expect(sessions).toBeGreaterThan(securityHistory)
    expect(refreshTokens).toBeGreaterThan(sessions)

    const historySource = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityHistorySection.tsx", import.meta.url),
    ).text()
    expect(historySource).toContain('summary={messageTranslate("shell.nav.securityHistory")}')
    expect(historySource).toContain("<AccountDisclosure")
    expect(historySource).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]")
    expect(historySource).toContain("onClick={props.state.securityHistoryLoadMore}")
    expect(historySource).toContain("account.securityHistory.description")
    expect(historySource).not.toContain("ProductionStatePanel")

    const sessionsSource = await Bun.file(
      new URL("../../src/features/account/ui/AccountSessionsSection.tsx", import.meta.url),
    ).text()
    expect(sessionsSource).toContain('summary={messageTranslate("shell.nav.sessionsDevices")}')
    expect(sessionsSource).toContain("<AccountDisclosure")
    expect(sessionsSource).toContain("<AuthenticatedDialog")
    expect(sessionsSource).toContain("onClick={() => state.sessionRevoke(session.id, props.state.sessionRevoke)}")
    expect(sessionsSource).not.toContain("ProductionStatePanel")

    const refreshTokensSource = await Bun.file(
      new URL("../../src/features/account/ui/AccountRefreshTokensSection.tsx", import.meta.url),
    ).text()
    expect(refreshTokensSource).toContain("state.tokensRevokeAll(props.state.refreshTokensRevokeAll)")
    expect(refreshTokensSource).toContain("state.tokenRevoke(token.familyId, props.state.refreshTokenRevoke)")
    expect(refreshTokensSource).toContain('summary={messageTranslate("shell.nav.applications")}')
    expect(refreshTokensSource).not.toContain("ProductionStatePanel")

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
    expect(disclosure).not.toMatch(/<details[^>]*\sopen(?:[=\s>])/s)
    expect(disclosure).toContain("focus-visible:ring-2")
  })

  test("keeps deletion in an initially collapsed danger card and a labelled dialog", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountDeleteView.tsx", import.meta.url),
    ).text()

    expect(source).toContain("<AccountDisclosure")
    expect(source).toContain('variant="card"')
    expect(source).toContain("icon={mdiAccountRemoveOutline}")
    expect(source).toContain('statusTone="danger"')
    expect(source.indexOf("<AccountDisclosure")).toBeLessThan(
      source.indexOf('messageTranslate("account.delete.warning")'),
    )
    expect(source).toContain("<AuthenticatedDialog")
    expect(source).toContain('title={messageTranslate("account.delete.title")}')
    expect(source).toContain("open={props.dialogOpen}")
    expect(source).toContain("onOpenChange={props.onDialogOpenChange}")
    expect(source.indexOf("<AuthenticatedDialog")).toBeLessThan(source.indexOf("onSubmit={props.onDelete}"))
    expect(source).toContain('messageTranslate("account.delete.confirmLabel"')
    expect(source).toContain('id="account-delete-confirmation"')
    expect(source).toContain('messageTranslate("account.delete.submit")')
    expect(source).toContain('variant="filledRed"')
    expect(source).toContain("disabled={props.pending}")
  })

  test("uses shared overview headings, readable status rows and secondary account actions", async () => {
    const workspace = await Bun.file(
      new URL("../../src/features/account/ui/AccountWorkspace.tsx", import.meta.url),
    ).text()
    const organizations = await Bun.file(
      new URL("../../src/features/account/ui/AccountOrganizationAccessView.tsx", import.meta.url),
    ).text()
    const status = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityStatus.tsx", import.meta.url),
    ).text()
    const history = await Bun.file(
      new URL("../../src/features/account/ui/AccountSecurityHistorySection.tsx", import.meta.url),
    ).text()
    const danger = await Bun.file(
      new URL("../../src/features/account/ui/AccountDeleteView.tsx", import.meta.url),
    ).text()

    expect(workspace).toContain('title={messageTranslate("account.workspace.devicesTitle")}')
    expect(workspace).not.toContain('description={messageTranslate("account.workspace.dangerDescription")}')
    expect(organizations).toContain('summary={messageTranslate("shell.nav.organizations")}')
    expect(organizations).toContain("value={state.organizationSummary()}")
    expect(status).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]")
    expect(status).toContain('class="break-words text-sm font-medium"')
    expect(history).toContain('class="min-w-0 break-words text-sm font-medium"')
    expect(history).toContain("onClick={props.state.securityHistoryLoadMore}")
    expect(danger).toContain('class="border-danger/35"')
    expect(danger).toContain('description={messageTranslate("account.delete.warning")}')

    for (const name of ["AccountPasskeysSection", "AccountRecoveryCodesSection"]) {
      const source = await Bun.file(new URL(`../../src/features/account/ui/${name}.tsx`, import.meta.url)).text()
      expect(source).toContain('variant="outline"')
    }
  })

  test("points invitation organization inspection to account access", async () => {
    const source = await Bun.file(
      new URL("../../src/features/account/ui/AccountAccessProductionAdapter.tsx", import.meta.url),
    ).text()

    expect(source).toContain('organizationsHref="/account#access"')
  })

  test("omits the global header organization switcher and label on the account shell", () => {
    createRoot((dispose) => {
      const accountRootState = productionAuthenticatedShellStateCreate(
        () => "account",
        () => "shell.nav.account",
      )
      expect(accountRootState.organizationSwitchable()).toBe(false)
      expect(accountRootState.organizationLabel()).toBe("")

      dispose()
    })
  })

  test("retains global header organization switcher on non-account routes when multiple organizations exist", () => {
    createRoot((dispose) => {
      const adminState = productionAuthenticatedShellStateCreate(
        () => "admin",
        () => "admin.navigation.label",
      )
      expect(adminState.organizationSwitchable()).toBe(true)
      expect(adminState.organizationLabel()).toBe("Northwind Labs")

      dispose()
    })
  })
})
