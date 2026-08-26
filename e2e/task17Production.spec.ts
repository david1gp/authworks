import { type ChildProcess, spawn } from "node:child_process"
import { type BrowserContext, expect, type Page, test } from "@playwright/test"
import { sessionBrowserModeHeaderName } from "../src/features/sessions/public/sessionBrowserModeHeaderName.js"

type E2eServerMetadata = {
  readonly administrator: {
    readonly email: string
    readonly id: string
    readonly password: string
    readonly userName: string
  }
  readonly administratorRecoveryCode?: string
  readonly bootstrapAdmin: { readonly secret: string }
  readonly discoveryDomain: string
  readonly externalProvider: { readonly clientSecret: string; readonly id: string }
  readonly machineUser: { readonly clientSecret: string; readonly id: string }
  readonly member: { readonly email: string; readonly id: string; readonly password: string; readonly userName: string }
  readonly oidcClients: { readonly approve: { readonly id: string }; readonly reject: { readonly id: string } }
  readonly origin: string
  readonly otherRealmId: string
  readonly organization: { readonly id: string; readonly name: string }
  readonly realm: { readonly id: string }
  readonly recoveryCode?: string
  readonly secondaryOrganization: { readonly id: string; readonly name: string }
  readonly serverOrigin: string
}

test("task 17 composed production scenario keeps browser sessions and tenants isolated", async ({ page }) => {
  test.setTimeout(120_000)
  const server = await e2eServerStart()
  const fixture = server.metadata

  try {
    await composedApiProxyInstall(page, fixture)

    const loginResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/password/login"),
    )
    await page.goto("/login/password?return_to=%2Faccount%2Fprofile")
    await page.getByLabel("Username or email").fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.member.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()

    await loginResponsePromise
    await expect(page).toHaveURL(/\/account\/profile$/)
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member")
    const memberSecretState = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(memberSecretState).not.toContain(fixture.member.password)
    expect(await page.locator("body").textContent()).not.toContain(fixture.member.password)

    await page.reload()
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member")
    await page.getByLabel("Display name", { exact: true }).fill("E2E Member Updated")
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("Your profile was saved.")

    await page.reload()
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member Updated")

    const tenantDenied = await page.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/me`, { credentials: "include" })
      return { body: await response.text(), status: response.status }
    }, fixture.otherRealmId)
    expect(tenantDenied.status).toBe(401)
    expect(tenantDenied.body).not.toContain(fixture.member.email)

    const csrf = await page.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/sessions/csrf`, { credentials: "include" })
      return (await response.json()) as { csrfToken: string }
    }, fixture.realm.id)
    const csrfDenied = await page.evaluate(
      async ({ realmId }) => {
        const response = await fetch(`/realms/${realmId}/me`, {
          body: JSON.stringify({ displayName: "should-not-save" }),
          credentials: "include",
          headers: { "content-type": "application/json" },
          method: "PATCH",
        })
        return { body: await response.text(), status: response.status }
      },
      { csrfToken: csrf.csrfToken, realmId: fixture.realm.id },
    )
    expect(csrfDenied.status).toBe(403)
    expect(csrfDenied.body).toContain("CSRF")

    const originDenied = await page.evaluate(
      async ({ csrfToken, realmId }) => {
        const response = await fetch(`/realms/${realmId}/me`, {
          body: JSON.stringify({ displayName: "should-not-save" }),
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
            "x-e2e-origin": "https://evil.example",
          },
          method: "PATCH",
        })
        return { body: await response.text(), status: response.status }
      },
      { csrfToken: csrf.csrfToken, realmId: fixture.realm.id },
    )
    expect(originDenied.status).toBe(403)
    expect(originDenied.body).toContain("origin")

    await page.goto("/login/logout")
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible()
    await page.goto("/account/profile")
    await expect(page).toHaveURL("/login?return_to=%2Faccount%2Fprofile")

    const adminDiscoveryPromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/organization-discovery",
    )
    await page.goto("/admin/sign-in")
    await adminDiscoveryPromise
    await page.getByLabel("Bootstrap administrator credential", { exact: true }).fill(fixture.bootstrapAdmin.secret)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()
    const adminSecretState = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(adminSecretState).not.toContain(fixture.bootstrapAdmin.secret)
    expect(await page.locator("body").textContent()).not.toContain(fixture.bootstrapAdmin.secret)
    expect(await page.locator("body").textContent()).not.toContain(fixture.machineUser.clientSecret)

    await page.reload()
    await page.goto("/admin/users")
    await expect(page.getByRole("link", { name: fixture.member.userName, exact: true })).toBeVisible()
    await page.getByRole("link", { name: fixture.member.userName, exact: true }).click()
    await expect(page.getByRole("heading", { name: "Sessions and devices", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "This user has no active sessions.", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Authentication methods", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Email code", exact: true })).toBeVisible()
    await expect(page.getByText("Available", { exact: true })).toBeVisible()
    await page.goto("/admin/users")
    await page.getByRole("button", { name: "Create user", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Email address", { exact: true }).fill("crud@e2e.authworks.test")
    await dialog.getByLabel("Username", { exact: true }).fill("e2e-crud")
    await dialog.getByLabel("Display name", { exact: true }).fill("E2E CRUD")
    await dialog.getByRole("button", { name: "Create", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("e2e-crud was created.")

    await page.getByRole("link", { name: "e2e-crud", exact: true }).click()
    await expect(page.getByRole("heading", { name: "E2E CRUD", exact: true })).toBeVisible()
    const userPath = new URL(page.url()).pathname
    const deleteApiPath = userPath.replace(`/admin/users/`, `/realms/${fixture.realm.id}/users/`)
    const deleteRequestUrls: string[] = []
    page.on("request", (request) => {
      if (request.method() === "DELETE" && new URL(request.url()).pathname === deleteApiPath)
        deleteRequestUrls.push(request.url())
    })
    await page.getByLabel("Display name", { exact: true }).fill("E2E CRUD Updated")
    await page.getByRole("button", { name: "Save profile", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("The user profile was saved.")
    const deleteButton = page.getByRole("button", { name: "Delete user", exact: true })
    const deleteConfirmation = page.getByRole("alertdialog")
    await deleteButton.click()
    await expect(deleteConfirmation).toBeVisible()
    await deleteConfirmation.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(deleteConfirmation).toHaveCount(0)
    expect(deleteRequestUrls).toHaveLength(0)

    await deleteButton.click()
    await expect(deleteConfirmation).toBeVisible()
    await deleteConfirmation.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("e2e-crud was deleted.")
    expect(deleteRequestUrls).toHaveLength(1)
  } finally {
    await page.close()
    await e2eServerStop(server.process)
  }
})

test("task 17 protocol scenario resumes external login through OIDC consent without exposing secrets", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000)
  const server = await e2eServerStart()
  const fixture = server.metadata
  const browserOrigin = "http://127.0.0.1:5174"
  const responseBodies: Array<Promise<string>> = []
  const requestUrls: string[] = []
  let providerAuthorizationUrl: URL | undefined

  try {
    await composedApiProxyInstall(page, fixture)
    page.on("request", (request) => requestUrls.push(request.url()))
    page.on("response", (response) => {
      const pathname = new URL(response.url()).pathname
      if (response.request().resourceType() === "document" || productionContextResponsePath(pathname)) return
      if (
        pathname === "/organization-discovery" ||
        pathname.startsWith("/realms/") ||
        pathname.startsWith("/oauth2/") ||
        response.url().startsWith("https://external-provider.e2e.authworks.test/")
      ) {
        responseBodies.push(
          response
            .text()
            .then((body) => `${JSON.stringify(response.headers())}\n${body}`)
            .catch(() => ""),
        )
      }
    })
    await page.route("https://external-provider.e2e.authworks.test/**", async (route) => {
      const providerUrl = new URL(route.request().url())
      providerAuthorizationUrl = providerUrl
      const redirectUri = providerUrl.searchParams.get("redirect_uri")
      if (redirectUri === null) {
        await route.fulfill({ body: "invalid provider request", status: 400 })
        return
      }
      const callbackPath = new URL(redirectUri).pathname
      const callbackOrigin = JSON.stringify(browserOrigin)
      const callbackPathLiteral = JSON.stringify(callbackPath)
      await route.fulfill({
        body: `<!doctype html><script>
          const callback = new URL(${callbackOrigin} + ${callbackPathLiteral});
          callback.searchParams.set("code", "e2e-external-code");
          callback.searchParams.set("state", new URL(location.href).searchParams.get("state") || "");
          location.assign(callback);
        </script>`,
        contentType: "text/html",
      })
    })
    const rejectState = "e2e-reject-state"
    const rejectInteraction = await oidcAuthorizationStart(page, fixture.oidcClients.reject.id, rejectState)
    const loginUrl = new URL(page.url())
    expect(loginUrl.pathname).toBe("/login")
    expect(loginUrl.searchParams.get("interaction")).toBe(rejectInteraction)
    expect(loginUrl.searchParams.get("return_to")).toBe(`/oauth2/authorize?interaction=${rejectInteraction}`)
    expect(loginUrl.search).not.toContain(fixture.oidcClients.reject.id)
    expect(loginUrl.search).not.toContain(rejectState)

    await page.getByRole("button", { name: /^Continue with Deterministic Provider/ }).click()
    await page.getByRole("button", { name: "Continue with Deterministic Provider", exact: true }).click()
    await expect.poll(() => providerAuthorizationUrl !== undefined).toBe(true)
    await expect(page).toHaveURL(/\/oauth2\/authorize\?interaction=/)
    expect(providerAuthorizationUrl?.searchParams.get("client_secret")).toBeNull()
    const resumedUrl = new URL(page.url())
    await page.goto(`${browserOrigin}${resumedUrl.pathname}${resumedUrl.search}`)
    await expect(page).toHaveURL(/\/consent\?interaction=/)
    const consentInteraction = new URL(page.url()).searchParams.get("interaction")
    expect(consentInteraction).toBe(rejectInteraction)
    expect(new URL(page.url()).searchParams.get("return_to")).toBe(`/oauth2/authorize?interaction=${rejectInteraction}`)

    const rejectCsrf = await browserCsrfTokenGet(page, fixture.realm.id)
    await page.setExtraHTTPHeaders({ "x-csrf-token": rejectCsrf })
    await consentSubmit(page, rejectInteraction, "deny")
    await page.setExtraHTTPHeaders({})
    const rejected = new URL(page.url())
    expect(rejected.origin).toBe(browserOrigin)
    expect(rejected.searchParams.get("error")).toBe("access_denied")
    expect(rejected.searchParams.get("code")).toBeNull()
    expect(rejected.searchParams.get("state")).toBe(rejectState)

    const approveState = "e2e-approve-state"
    const approveInteraction = await oidcAuthorizationStart(page, fixture.oidcClients.approve.id, approveState)
    expect(new URL(page.url()).pathname).toBe("/consent")
    expect(new URL(page.url()).searchParams.get("interaction")).toBe(approveInteraction)
    const approveCsrf = await browserCsrfTokenGet(page, fixture.realm.id)
    await page.setExtraHTTPHeaders({ "x-csrf-token": approveCsrf })
    await consentSubmit(page, approveInteraction, "approve")
    await page.setExtraHTTPHeaders({})
    const approved = new URL(page.url())
    expect(approved.origin).toBe(browserOrigin)
    expect(approved.searchParams.get("code")).toBeTruthy()
    expect(approved.searchParams.get("error")).toBeNull()
    expect(approved.searchParams.get("state")).toBe(approveState)

    await browserSecretsAssert(
      page,
      context,
      [
        fixture.bootstrapAdmin.secret,
        fixture.externalProvider.clientSecret,
        fixture.machineUser.clientSecret,
        fixture.member.password,
        "authworks-e2e-system-secret",
      ],
      responseBodies,
      requestUrls,
    )
  } finally {
    await page.close()
    await e2eServerStop(server.process)
  }
})

test("task 17 composed production scenario displays and revokes machine secrets, delivers an invitation, and reloads its deep link", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000)
  const server = await e2eServerStart({ credentialScenario: true })
  const fixture = server.metadata
  const administratorRecoveryCode = fixture.administratorRecoveryCode
  const memberRecoveryCode = fixture.recoveryCode
  if (administratorRecoveryCode === undefined || memberRecoveryCode === undefined) {
    throw new Error("The credential E2E fixture did not provide its deterministic recovery codes.")
  }

  const machineSecrets: string[] = []
  const laterResponseBodies: Array<Promise<string>> = []
  const invitationAcknowledgedResponseBodies: Array<Promise<string>> = []
  let collectLaterResponses = false
  let collectInvitationAcknowledgedResponses = false
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.startsWith("/realms/")) return
    if (collectLaterResponses) laterResponseBodies.push(response.text().catch(() => ""))
    if (collectInvitationAcknowledgedResponses)
      invitationAcknowledgedResponseBodies.push(response.text().catch(() => ""))
  })

  try {
    await composedApiProxyInstall(page, fixture)
    await page.goto(`/login/password?return_to=${encodeURIComponent(`/admin/machine-users/${fixture.machineUser.id}`)}`)
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.administrator.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.administrator.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/mfa\?return_to=/)
    await page.getByRole("button", { name: /^Recovery code/ }).click()
    await page.getByLabel("Recovery code", { exact: true }).fill(administratorRecoveryCode)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/machine-users/${fixture.machineUser.id}$`))

    await page.getByRole("button", { name: "Rotate client secret", exact: true }).click()
    const rotateConfirmation = page.getByRole("alertdialog")
    await expect(rotateConfirmation).toBeVisible()
    await rotateConfirmation.getByRole("button", { name: "Continue", exact: true }).click()
    machineSecrets.push(await machineSecretAcknowledge(page))
    await expect(page.locator("[data-secret-redacted]")).toBeVisible()

    machineSecrets.push(await machineCredentialIssue(page, "personal_access_token", "E2E PAT"))
    machineSecrets.push(await machineCredentialIssue(page, "api_key", "E2E API key"))

    collectLaterResponses = true
    await page.reload()
    await expect(page.locator("[data-secret-redacted]")).toBeVisible()
    await expect(page.locator("[data-one-time-secret='machine-credential']")).toHaveCount(0)

    for (const name of ["E2E PAT", "E2E API key"]) {
      const row = page.getByRole("row").filter({ hasText: name })
      await expect(row).toContainText("Active")
      await row.getByRole("button", { name: "Revoke", exact: true }).click()
      const revokeConfirmation = page.getByRole("alertdialog")
      await expect(revokeConfirmation).toBeVisible()
      await revokeConfirmation.getByRole("button", { name: "Continue", exact: true }).click()
      await expect(row).toContainText("Revoked")
    }
    await page.reload()
    await expect(page.locator("[data-secret-redacted]")).toBeVisible()

    await page.goto("/admin/invitations")
    await page.getByLabel("Email address", { exact: true }).fill(fixture.member.email)
    await page.getByRole("button", { name: "Invite person", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("The invitation was created.")
    const invitationLink = await server.invitationLinkGet()
    const invitationUrl = new URL(invitationLink)
    expect(invitationUrl.origin).toBe(fixture.origin)
    expect(invitationUrl.pathname).toBe("/invitations/accept")
    const invitationToken = invitationUrl.searchParams.get("token")
    if (invitationToken === null) throw new Error("The captured invitation email did not contain a token.")
    const invitationPanel = page.locator("[data-one-time-secret='organization-invitation']")
    await expect(invitationPanel).toBeVisible()
    await invitationPanel.getByRole("button", { name: "I saved this link", exact: true }).click()
    await expect(invitationPanel).toHaveCount(0)
    collectInvitationAcknowledgedResponses = true

    await page.goto("/login/logout")
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    await page.goto("/login/password")
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.member.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/mfa/)
    await page.getByRole("button", { name: /^Recovery code/ }).click()
    await page.getByLabel("Recovery code", { exact: true }).fill(memberRecoveryCode)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)

    const browserInvitationUrl = `${new URL(page.url()).origin}${invitationUrl.pathname}${invitationUrl.search}`
    await page.goto(browserInvitationUrl)
    await expect(page.getByRole("heading", { name: fixture.organization.id, exact: true })).toBeVisible()
    await page.reload({ waitUntil: "commit" })
    await expect(page.getByRole("heading", { name: fixture.organization.id, exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Invitation accepted", exact: true })).toBeVisible()

    await page.goto("/account/profile")
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member")
    await page.reload()
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member")

    const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    const browserCookies = (await context.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("\n")
    const browserText = (await page.locator("body").textContent()) ?? ""
    const responses = await Promise.all(laterResponseBodies)
    const invitationAcknowledgedResponses = await Promise.all(invitationAcknowledgedResponseBodies)
    for (const secret of machineSecrets) {
      expect(browserStorage).not.toContain(secret)
      expect(browserCookies).not.toContain(secret)
      expect(browserText).not.toContain(secret)
      expect(responses.every((body) => !body.includes(secret))).toBe(true)
    }
    expect(browserStorage).not.toContain(invitationToken)
    expect(invitationAcknowledgedResponses.every((body) => !body.includes(invitationToken))).toBe(true)
  } finally {
    await page.close()
    await e2eServerStop(server.process)
  }
})

async function machineCredentialIssue(page: Page, kind: "api_key" | "personal_access_token", name: string) {
  const route = new URL(page.url())
  if (kind === "api_key") {
    route.searchParams.set("kind", kind)
    await page.goto(`${route.pathname}?${route.searchParams.toString()}`)
  }
  await page.getByRole("button", { name: "Issue credential", exact: true }).click()
  await page.getByRole("dialog").getByLabel("Credential type", { exact: true }).selectOption(kind)
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name)
  await expect(page.getByRole("dialog").getByRole("button", { name: "Issue credential", exact: true })).toBeEnabled()
  await page.getByRole("dialog").getByRole("button", { name: "Issue credential", exact: true }).click()
  return machineSecretAcknowledge(page)
}

async function machineSecretAcknowledge(page: Page): Promise<string> {
  const panel = page.locator("[data-one-time-secret='machine-credential']")
  await expect(panel).toBeVisible()
  const secret = (await panel.locator("[data-secret-value]").textContent())?.trim()
  if (secret === undefined || secret.length === 0) throw new Error("The machine secret was not displayed.")
  await panel.getByRole("button", { name: "Copy secret", exact: true }).click()
  await panel.getByRole("button", { name: "I have stored the secret", exact: true }).click()
  await expect(panel).toHaveCount(0)
  return secret
}

async function composedApiProxyInstall(
  page: Page,
  fixture: {
    readonly discoveryDomain: string
    readonly origin: string
    readonly serverOrigin: string
  },
) {
  await page.route("**/*", async (route) => {
    const browserUrl = new URL(route.request().url())
    if (
      browserUrl.pathname !== "/organization-discovery" &&
      !browserUrl.pathname.startsWith("/realms/") &&
      !browserUrl.pathname.startsWith("/oauth2/")
    ) {
      await route.continue()
      return
    }

    const headers = new Headers(route.request().headers())
    const requestedOrigin = headers.get("x-e2e-origin")
    headers.delete("x-e2e-origin")
    headers.delete("content-length")
    headers.set("origin", requestedOrigin ?? fixture.origin)
    if (/^\/realms\/[^/]+\/external-identity\/[^/]+\/callback$/.test(browserUrl.pathname))
      headers.set(sessionBrowserModeHeaderName, "true")
    const target = new URL(`${fixture.serverOrigin}${browserUrl.pathname}${browserUrl.search}`)
    if (browserUrl.pathname === "/organization-discovery") target.searchParams.set("domain", fixture.discoveryDomain)
    const response = await fetch(target, {
      body: route.request().postData() ?? undefined,
      headers,
      method: route.request().method(),
      redirect: "manual",
    })
    await route.fulfill({
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
    })
  })
}

function productionContextResponsePath(pathname: string): boolean {
  return (
    pathname === "/organization-discovery" ||
    /^\/realms\/[^/]+(?:\/sessions\/current|\/me(?:\/organizations)?)?$/.test(pathname)
  )
}

async function e2eServerStart(options: { readonly credentialScenario?: boolean } = {}): Promise<{
  readonly metadata: E2eServerMetadata
  readonly process: ChildProcess
  readonly invitationLinkGet: () => Promise<string>
}> {
  const child = spawn("bun", ["e2e/authworksE2eServer.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(options.credentialScenario === true ? { AUTHWORKS_E2E_CREDENTIAL_SCENARIO: "1" } : {}),
    },
    stdio: ["ignore", "pipe", "inherit"],
  })
  return new Promise((resolve, reject) => {
    if (child.stdout === null) {
      reject(new Error("The E2E server output was not available."))
      return
    }
    const stdout = child.stdout
    let buffer = ""
    let metadata: E2eServerMetadata | undefined
    let invitationLinkResolve: ((link: string) => void) | undefined
    let invitationLinkReject: ((error: Error) => void) | undefined
    const invitationLink = new Promise<string>((linkResolve, linkReject) => {
      invitationLinkResolve = linkResolve
      invitationLinkReject = linkReject
    })
    const ready = (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let newline = buffer.indexOf("\n")
      while (newline >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (line.startsWith("ERROR ")) {
          const error = new Error(line.slice("ERROR ".length))
          invitationLinkReject?.(error)
          reject(error)
          return
        }
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch (_error) {
          newline = buffer.indexOf("\n")
          continue
        }
        if (typeof parsed === "object" && parsed !== null && "ready" in parsed && parsed.ready === true) {
          metadata = parsed as unknown as E2eServerMetadata
          resolve({ metadata, process: child, invitationLinkGet: () => invitationLink })
        }
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "invitationLink" in parsed &&
          typeof parsed.invitationLink === "string"
        ) {
          invitationLinkResolve?.(parsed.invitationLink)
        }
        newline = buffer.indexOf("\n")
      }
    }
    stdout.on("data", ready)
    child.once("error", (error) => {
      invitationLinkReject?.(error)
      reject(error)
    })
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        const error = new Error(`The E2E server exited with status ${code}.`)
        invitationLinkReject?.(error)
        reject(error)
      }
    })
  })
}

async function e2eServerStop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await new Promise<void>((resolve) => child.once("exit", () => resolve()))
}

async function oidcAuthorizationStart(page: Page, clientId: string, state: string): Promise<string> {
  const request = new URLSearchParams({
    client_id: clientId,
    code_challenge: "A".repeat(43),
    code_challenge_method: "S256",
    redirect_uri: "http://127.0.0.1:5174/callback",
    response_type: "code",
    scope: "openid",
    state,
  })
  await page.goto(`/oauth2/authorize?${request.toString()}`)
  const interaction = new URL(page.url()).searchParams.get("interaction")
  expect(interaction).toMatch(/^[A-Za-z0-9_-]{43}$/)
  if (interaction === null) throw new Error("The OIDC interaction handle was not returned.")
  return interaction
}

async function browserCsrfTokenGet(page: Page, realmId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/realms/${id}/sessions/csrf`, { credentials: "include" })
    const body = (await response.json()) as { csrfToken: string }
    return body.csrfToken
  }, realmId)
}

async function consentSubmit(page: Page, interaction: string, decision: "approve" | "deny"): Promise<void> {
  await page.evaluate(
    ({ decision: selectedDecision, interaction: selectedInteraction }) => {
      const form = document.createElement("form")
      form.action = "/oauth2/consent"
      form.method = "post"
      const fields: Array<[string, string]> = [
        ["decision", selectedDecision],
        ["interaction", selectedInteraction],
      ]
      for (const [name, value] of fields) {
        const input = document.createElement("input")
        input.name = name
        input.type = "hidden"
        input.value = value
        form.append(input)
      }
      document.body.append(form)
      form.submit()
    },
    { decision, interaction },
  )
  await page.waitForURL(/http:\/\/127\.0\.0\.1:5174\/callback\?/)
}

async function browserSecretsAssert(
  page: Page,
  context: BrowserContext,
  secrets: readonly string[],
  responseBodies: ReadonlyArray<Promise<string>>,
  requestUrls: readonly string[],
): Promise<void> {
  const responses = await Promise.all(responseBodies)
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  const browserCookies = (await context.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("\n")
  const browserText = (await page.locator("body").textContent()) ?? ""
  for (const secret of secrets) {
    expect(browserStorage).not.toContain(secret)
    expect(browserCookies).not.toContain(secret)
    expect(browserText).not.toContain(secret)
    expect(responses.every((body) => !body.includes(secret))).toBe(true)
    expect(requestUrls.every((url) => !url.includes(secret))).toBe(true)
  }
}
