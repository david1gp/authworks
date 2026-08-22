import { type ChildProcess, spawn } from "node:child_process"
import { expect, type Browser, type BrowserContext, type Page, test } from "@playwright/test"

type E2eServerMetadata = {
  readonly administrator: {
    readonly email: string
    readonly id: string
    readonly password: string
    readonly userName: string
  }
  readonly bootstrapAdmin: { readonly secret: string }
  readonly discoveryDomain: string
  readonly member: { readonly email: string; readonly id: string; readonly password: string; readonly userName: string }
  readonly now: number
  readonly origin: string
  readonly recoveryCode: string
  readonly realm: { readonly id: string }
  readonly serverOrigin: string
}

test("task 17 composed impersonation scenario enforces lifecycle, safeguards, and denial states", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(60_000)
  const server = await e2eServerStart()
  const fixture = server.metadata
  const auxiliaryContexts: BrowserContext[] = []
  const responseBodies: Array<Promise<string>> = []
  const requestUrls: string[] = []

  try {
    await composedApiProxyInstall(page, fixture)
    browserObservationInstall(page, responseBodies, requestUrls)
    page.on("dialog", (dialog) => void dialog.accept())

    await adminSignIn(page, fixture.bootstrapAdmin.secret)
    const bootstrapCookie = await sessionCookieGet(context)

    const assurance = await auxiliaryPageCreate(browser, fixture, auxiliaryContexts, responseBodies, requestUrls)
    await passwordSignIn(assurance, fixture.administrator, "/admin/impersonation")
    await expect(assurance.getByRole("heading", { name: "Stronger sign-in required", exact: true })).toBeVisible()
    const assuranceDenied = await impersonationStartRequest(assurance, fixture, fixture.member.id)
    expect(assuranceDenied.status).toBe(403)
    expect(assuranceDenied.body).toContain("Multi-factor authentication is required")
    expect(assuranceDenied.body).toContain("authorization.insufficient-assurance")

    const permission = await auxiliaryPageCreate(browser, fixture, auxiliaryContexts, responseBodies, requestUrls)
    await passwordSignIn(permission, fixture.member, "/account/profile")
    const steppedUp = await mfaStepUpComplete(permission, fixture)
    expect(steppedUp.status).toBe(200)
    expect(steppedUp.body).not.toContain(fixture.recoveryCode)
    const permissionDenied = await impersonationStartRequest(permission, fixture, fixture.administrator.id)
    expect(permissionDenied.status).toBe(403)
    expect(permissionDenied.body).toContain("not authorized")
    expect(permissionDenied.body).toContain("authorization.forbidden")
    await permission.goto("/admin/impersonation")
    await expect(permission.getByRole("heading", { name: "Access unavailable", exact: true })).toBeVisible()

    await page.goto(`/admin/users/${fixture.administrator.id}`)
    await expect(page.getByRole("heading", { name: "E2E Administrator", exact: true })).toBeVisible()
    await page.getByRole("link", { name: "Impersonate this user", exact: true }).click()
    await expect(page.getByLabel("Reason", { exact: true })).toBeVisible()
    await page.getByLabel("Reason", { exact: true }).fill("Ticket IMP-17: investigate the support report.")
    await page.getByLabel("Duration", { exact: true }).selectOption("300")
    const startResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/realms/${fixture.realm.id}/impersonations`,
    )
    await page.getByRole("button", { name: "Start impersonation", exact: true }).click()
    const startResponse = await startResponsePromise
    const startBody = (await startResponse.json()) as {
      readonly session?: {
        readonly expiresAt: number
        readonly id: string
        readonly impersonated?: true
        readonly impersonationReason?: string
        readonly subjectId: string
      }
      readonly token?: string
    }
    expect(startResponse.status()).toBe(201)
    expect(startBody.token).toBeUndefined()
    expect(startBody.session).toMatchObject({
      expiresAt: fixture.now + 5 * 60 * 1_000,
      impersonated: true,
      impersonationReason: "Ticket IMP-17: investigate the support report.",
      subjectId: fixture.administrator.id,
    })
    const impersonationSessionId = startBody.session?.id
    if (impersonationSessionId === undefined) throw new Error("The impersonation session ID was not returned.")
    const impersonationCookie = await sessionCookieGet(context)
    expect(impersonationCookie).toHaveLength(43)
    expect(impersonationCookie).not.toBe(bootstrapCookie)
    expect(await page.evaluate(() => document.cookie)).not.toContain(impersonationCookie ?? "")
    expect(JSON.stringify(startBody)).not.toContain(impersonationCookie ?? "")
    await expect(page.getByRole("status")).toContainText("You are now acting as E2E Administrator.")
    await expect(page.locator("[data-impersonation-banner]")).toContainText("E2E Administrator")
    await expect(page.locator("[data-impersonation-banner]")).toContainText(/\d+:\d{2}/)

    const auditContextPage = await auxiliaryPageCreate(browser, fixture, auxiliaryContexts, responseBodies, requestUrls)
    await adminSignIn(auditContextPage, fixture.bootstrapAdmin.secret)
    await auditContextPage.goto(`/admin/events?q=${encodeURIComponent(impersonationSessionId)}`)
    await expect(auditContextPage.getByText("impersonation.started", { exact: true })).toBeVisible()
    await auditContextPage.getByRole("button", { name: "Show payload", exact: true }).first().click()
    await expect(auditContextPage.locator("body")).toContainText("Ticket IMP-17: investigate the support report.")

    await page.goto("/account/profile")
    await expect(page.locator("[data-impersonation-banner]")).toContainText("E2E Administrator")
    await page.reload()
    await expect(page.locator("[data-impersonation-banner]")).toContainText("E2E Administrator")
    await page.goto("/account/email")
    await expect(page.locator("[data-impersonation-banner]")).toContainText("E2E Administrator")

    const nested = await impersonationStartRequest(page, fixture, fixture.member.id)
    expect(nested.status).toBe(403)
    expect(nested.body).toContain("another impersonation session")
    expect(nested.body).toContain("authorization.impersonation-forbidden")

    const endResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/realms/${fixture.realm.id}/impersonations/${impersonationSessionId}/end`,
    )
    await page.locator("[data-impersonation-banner]").getByRole("button", { name: "End impersonation" }).click()
    expect((await endResponsePromise).status()).toBe(200)
    await expect(page.locator("[data-impersonation-banner]")).toHaveCount(0)
    const endedSession = await page.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/sessions/current`, { credentials: "include" })
      return { body: await response.text(), status: response.status }
    }, fixture.realm.id)
    expect(endedSession.status).toBe(401)

    await auditContextPage.reload()
    await expect(auditContextPage.getByText("impersonation.started", { exact: true })).toBeVisible()
    await expect(auditContextPage.getByText("impersonation.ended", { exact: true })).toBeVisible()

    await auditContextPage.goto(`/admin/impersonation?userId=${fixture.administrator.id}`)
    await auditContextPage.getByLabel("Reason", { exact: true }).fill("Ticket IMP-17: verify automatic expiry.")
    await auditContextPage.getByLabel("Duration", { exact: true }).selectOption("300")
    const expiryResponsePromise = auditContextPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/realms/${fixture.realm.id}/impersonations`,
    )
    await auditContextPage.getByRole("button", { name: "Start impersonation", exact: true }).click()
    const expiryResponse = await expiryResponsePromise
    expect(expiryResponse.status()).toBe(201)
    await expect(auditContextPage.locator("[data-impersonation-banner]")).toContainText("E2E Administrator")
    server.process.kill("SIGUSR1")
    const expiredSession = await auditContextPage.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/sessions/current`, { credentials: "include" })
      return { body: await response.text(), status: response.status }
    }, fixture.realm.id)
    expect(expiredSession.status).toBe(401)
    await auditContextPage.reload()
    await expect(auditContextPage.locator("[data-impersonation-banner]")).toHaveCount(0)
    await expect(auditContextPage.locator("[data-content-state='inaccessible']")).toBeVisible()

    await browserSecretsAssert(
      [page, assurance, permission, auditContextPage],
      [context, ...auxiliaryContexts],
      [
        fixture.bootstrapAdmin.secret,
        fixture.administrator.password,
        fixture.member.password,
        fixture.recoveryCode,
        "authworks-e2e-system-secret",
        "authworks-e2e-external-provider-secret",
      ],
      responseBodies,
      requestUrls,
    )
  } finally {
    for (const auxiliaryContext of auxiliaryContexts) await auxiliaryContext.close()
    await e2eServerStop(server.process)
  }
})

async function composedApiProxyInstall(
  page: Page,
  fixture: { readonly discoveryDomain: string; readonly origin: string; readonly serverOrigin: string },
): Promise<void> {
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

async function auxiliaryPageCreate(
  browser: Browser,
  fixture: E2eServerMetadata,
  contexts: BrowserContext[],
  responseBodies: Array<Promise<string>>,
  requestUrls: string[],
): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:5174" })
  contexts.push(context)
  const page = await context.newPage()
  await composedApiProxyInstall(page, fixture)
  browserObservationInstall(page, responseBodies, requestUrls)
  page.on("dialog", (dialog) => void dialog.accept())
  return page
}

async function adminSignIn(page: Page, secret: string): Promise<void> {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Bootstrap administrator credential", { exact: true }).fill(secret)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Administrator session active", exact: true })).toBeVisible()
}

async function passwordSignIn(
  page: Page,
  user: { readonly email: string; readonly password: string },
  returnTo: string,
): Promise<void> {
  await page.goto(`/login/password?return_to=${encodeURIComponent(returnTo)}`)
  await page.getByLabel("Username or email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${returnTo.replaceAll("/", "\\/")}$`))
}

async function browserCsrfTokenGet(page: Page, realmId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/realms/${id}/sessions/csrf`, { credentials: "include" })
    const body = (await response.json()) as { readonly csrfToken: string }
    return body.csrfToken
  }, realmId)
}

async function impersonationStartRequest(
  page: Page,
  fixture: E2eServerMetadata,
  targetUserId: string,
): Promise<{ readonly body: string; readonly status: number }> {
  const csrfToken = await browserCsrfTokenGet(page, fixture.realm.id)
  return page.evaluate(
    async ({ csrf, realmId, target }) => {
      const response = await fetch(`/realms/${realmId}/impersonations`, {
        body: JSON.stringify({
          durationSeconds: 300,
          reason: "Ticket IMP-17: API denial check.",
          targetUserId: target,
        }),
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      })
      return { body: await response.text(), status: response.status }
    },
    { csrf: csrfToken, realmId: fixture.realm.id, target: targetUserId },
  )
}

async function mfaStepUpComplete(
  page: Page,
  fixture: E2eServerMetadata,
): Promise<{ readonly body: string; readonly status: number }> {
  const csrfToken = await browserCsrfTokenGet(page, fixture.realm.id)
  const challenge = await page.evaluate(
    async ({ csrf, realmId }) => {
      const response = await fetch(`/realms/${realmId}/mfa/step-up/start`, {
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      })
      return (await response.json()) as { readonly token: string }
    },
    { csrf: csrfToken, realmId: fixture.realm.id },
  )
  return page.evaluate(
    async ({ code, csrf, realmId, token }) => {
      const response = await fetch(`/realms/${realmId}/mfa/step-up/complete`, {
        body: JSON.stringify({ code, token }),
        credentials: "include",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        method: "POST",
      })
      return { body: await response.text(), status: response.status }
    },
    { code: fixture.recoveryCode, csrf: csrfToken, realmId: fixture.realm.id, token: challenge.token },
  )
}

async function sessionCookieGet(context: BrowserContext): Promise<string | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === "session")?.value
}

function browserObservationInstall(page: Page, responseBodies: Array<Promise<string>>, requestUrls: string[]): void {
  page.on("request", (request) => requestUrls.push(request.url()))
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.startsWith("/realms/")) return
    responseBodies.push(
      response
        .text()
        .then((body) => `${JSON.stringify(response.headers())}\n${body}`)
        .catch(() => ""),
    )
  })
}

async function browserSecretsAssert(
  pages: readonly Page[],
  contexts: readonly BrowserContext[],
  secrets: readonly string[],
  responseBodies: ReadonlyArray<Promise<string>>,
  requestUrls: readonly string[],
): Promise<void> {
  const responses = await Promise.all(responseBodies)
  for (const page of pages) {
    const pageState = await page.evaluate(() =>
      JSON.stringify({ body: document.body.textContent, cookie: document.cookie, localStorage, sessionStorage }),
    )
    for (const secret of secrets) expect(pageState).not.toContain(secret)
  }
  for (const context of contexts) {
    const cookies = (await context.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("\n")
    for (const secret of secrets) expect(cookies).not.toContain(secret)
  }
  for (const secret of secrets) {
    expect(responses.every((body) => !body.includes(secret))).toBe(true)
    expect(requestUrls.every((url) => !url.includes(secret))).toBe(true)
  }
}

async function e2eServerStart(): Promise<{ readonly metadata: E2eServerMetadata; readonly process: ChildProcess }> {
  const child = spawn("bun", ["e2e/authworksImpersonationE2eServer.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "inherit"],
  })
  return new Promise((resolve, reject) => {
    if (child.stdout === null) {
      reject(new Error("The impersonation E2E server output was not available."))
      return
    }
    let buffer = ""
    const ready = (chunk: Buffer | string) => {
      buffer += chunk.toString()
      const line = buffer.split("\n")[0]
      if (line === undefined) return
      if (line.startsWith("ERROR ")) {
        reject(new Error(line.slice("ERROR ".length)))
        return
      }
      if (!line.includes('"ready":true')) return
      child.stdout?.off("data", ready)
      resolve({ metadata: JSON.parse(line) as E2eServerMetadata, process: child })
    }
    child.stdout.on("data", ready)
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`The impersonation E2E server exited with status ${code}.`))
    })
  })
}

async function e2eServerStop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await new Promise<void>((resolve) => child.once("exit", () => resolve()))
}
