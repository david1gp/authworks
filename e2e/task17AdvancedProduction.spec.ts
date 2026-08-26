import { type ChildProcess, spawn } from "node:child_process"
import { expect, type Page, test } from "@playwright/test"

type E2eServerMetadata = {
  readonly discoveryDomain: string
  readonly member: { readonly email: string; readonly password: string }
  readonly organization: { readonly id: string; readonly name: string }
  readonly origin: string
  readonly recoveryCode: string
  readonly secondaryOrganization: { readonly id: string; readonly name: string }
  readonly realm: { readonly id: string }
  readonly serverOrigin: string
}

const recoveryPassword = "E2E Recovery Password 123!"

test("task 17 composed production authentication preserves recovery, MFA, deep links, locale, and expiry", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const server = await e2eServerStart()
  const fixture = server.metadata

  try {
    await composedApiProxyInstall(page, fixture)
    await page.goto("/login/password")

    const language = page.locator("select").first()
    await expect(language).toHaveValue("en")
    await language.selectOption("de")
    await expect(page.locator("html")).toHaveAttribute("lang", "de")
    await expect(language).toHaveValue("de")
    expect(await page.evaluate(() => localStorage.getItem("authworks:language:v1"))).toBe("de")
    await page.reload()
    await expect(page.locator("select").first()).toHaveValue("de")
    await page.locator("select").first().selectOption("en")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")

    await page.goto("/login/password/forgot")
    await page.getByLabel("Email address", { exact: true }).fill(fixture.member.email)
    await page.getByRole("button", { name: "Send reset link", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/password\/forgot\/sent$/)
    const recoveryLink = await server.recoveryLinkGet()
    const recoveryUrl = new URL(recoveryLink)
    expect(recoveryUrl.origin).toBe(fixture.origin)
    expect(recoveryUrl.pathname).toBe("/login/password/reset")
    const recoveryToken = recoveryUrl.searchParams.get("token")
    if (recoveryToken === null) throw new Error("The captured recovery email did not contain a token.")
    expect(await page.locator("body").textContent()).not.toContain(recoveryToken)

    await page.goto(`${new URL(page.url()).origin}${recoveryUrl.pathname}${recoveryUrl.search}`)
    await page.reload()
    await page.getByLabel("New password", { exact: true }).fill(recoveryPassword)
    await page.getByLabel("Confirm new password", { exact: true }).fill(recoveryPassword)
    await page.getByRole("button", { name: "Set new password", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Your password was changed", exact: true })).toBeVisible()

    await page.goto("/login/passkey")
    await page.evaluate(() => {
      Object.defineProperty(navigator.credentials, "get", {
        configurable: true,
        value: async () => null,
      })
    })
    const passkeyStartPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/passkeys/authentication/start"),
    )
    await page.getByRole("button", { name: "Continue with passkey", exact: true }).click()
    const passkeyStart = await passkeyStartPromise
    const passkeyBody = (await passkeyStart.json()) as {
      readonly options: { readonly challenge: string; readonly rpId?: string; readonly userVerification: string }
      readonly token: string
    }
    expect(passkeyStart.status()).toBe(200)
    expect(passkeyBody.options.rpId).toBe("e2e.authworks.test")
    expect(passkeyBody.options.userVerification).toBe("required")
    expect(passkeyBody.token.length).toBeGreaterThanOrEqual(43)
    await expect(page.getByRole("alert")).toContainText("Passkey sign-in was canceled or timed out. Try again.")
    expect(await page.locator("body").textContent()).not.toContain(passkeyBody.token)

    const passwordLoginPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/password/login"),
    )
    await page.goto("/login/password?return_to=%2Faccount%2Fprofile")
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(recoveryPassword)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const passwordLogin = await passwordLoginPromise
    expect(passwordLogin.status()).toBe(200)
    await expect(page).toHaveURL(/\/login\/mfa\?return_to=%2Faccount%2Fprofile$/)
    await page.getByRole("button", { name: /^Recovery code/ }).click()
    await page.getByLabel("Recovery code", { exact: true }).fill(fixture.recoveryCode)
    const mfaCompletePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/mfa/challenge/complete"),
    )
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    const mfaComplete = await mfaCompletePromise
    expect(mfaComplete.status()).toBe(200)
    await expect(page).toHaveURL(/\/account\/profile$/)

    const currentSession = await page.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/sessions/current`, { credentials: "include" })
      return {
        body: (await response.json()) as {
          readonly session?: { readonly expiresAt: number; readonly mfaMethod?: string }
        },
        status: response.status,
      }
    }, fixture.realm.id)
    expect(currentSession.status).toBe(200)
    expect(currentSession.body.session?.mfaMethod).toBe("recovery_code")
    const expiresAt = currentSession.body.session?.expiresAt
    if (expiresAt === undefined) throw new Error("The composed session did not expose an expiry timestamp.")

    server.process.kill("SIGUSR1")
    const expiredSession = await page.evaluate(async (realmId) => {
      const response = await fetch(`/realms/${realmId}/sessions/current`, { credentials: "include" })
      return { body: await response.text(), status: response.status }
    }, fixture.realm.id)
    expect(expiredSession.status).toBe(401)
    expect(expiredSession.body).not.toContain(recoveryPassword)
    await page.reload()
    await expect(page).toHaveURL("/login?return_to=%2Faccount%2Fprofile")
  } finally {
    await e2eServerStop(server.process)
  }
})

test("task 17 composed production account increment consumes captured links and protects account mutations", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const server = await e2eServerStart()
  const fixture = server.metadata
  const responseBodies: Array<Promise<string>> = []
  let collectResponseBodies = false
  page.on("response", (response) => {
    if (!collectResponseBodies || response.request().resourceType() === "document") return
    const pathname = new URL(response.url()).pathname
    if (pathname !== "/organization-discovery" && !pathname.startsWith("/realms/")) return
    responseBodies.push(
      Promise.race([
        response.text().catch(() => ""),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 1_000)),
      ]),
    )
  })

  const secretAbsent = async (secret: string) => {
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    const cookies = (await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("\n")
    const body = (await page.locator("body").textContent()) ?? ""
    expect(storage).not.toContain(secret)
    expect(cookies).not.toContain(secret)
    expect(body).not.toContain(secret)
    expect((await Promise.all(responseBodies)).every((response) => !response.includes(secret))).toBe(true)
  }

  try {
    await composedApiProxyInstall(page, fixture)

    const registeredEmail = "account-increment@e2e.authworks.test"
    const registeredPassword = "E2E Account Increment 123!"
    await page.goto("/login/register")
    await page.getByLabel("Full name", { exact: true }).fill("Account Increment")
    await page.getByLabel("Email address", { exact: true }).fill(registeredEmail)
    await page.getByLabel("Username", { exact: true }).fill("account-increment")
    await page.getByLabel("New password", { exact: true }).fill(registeredPassword)
    await page.getByLabel("Confirm password", { exact: true }).fill(registeredPassword)
    await page.getByRole("button", { name: "Create account", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/register\/done$/)

    const verificationLink = await server.verificationLinkGet()
    const verificationUrl = new URL(verificationLink)
    expect(verificationUrl.origin).toBe(fixture.origin)
    expect(verificationUrl.pathname).toBe("/login/verify-email")
    const verificationToken = verificationUrl.searchParams.get("token")
    if (verificationToken === null) throw new Error("The captured verification email did not contain a token.")

    collectResponseBodies = true
    await page.goto(`${new URL(page.url()).origin}${verificationUrl.pathname}${verificationUrl.search}`)
    await page.reload()
    expect(await page.locator("body").textContent()).not.toContain(verificationToken)
    await page.getByRole("button", { name: "Confirm email address", exact: true }).click()
    await expect(page.getByRole("status")).toBeVisible()
    expect(page.url()).not.toContain(verificationToken)
    await secretAbsent(verificationToken)

    await page.goto("/login/password/forgot")
    await page.getByLabel("Email address", { exact: true }).fill(fixture.member.email)
    await page.getByRole("button", { name: "Send reset link", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/password\/forgot\/sent$/)

    const recoveryLink = await server.recoveryLinkGet()
    const recoveryUrl = new URL(recoveryLink)
    expect(recoveryUrl.origin).toBe(fixture.origin)
    expect(recoveryUrl.pathname).toBe("/login/password/reset")
    const recoveryToken = recoveryUrl.searchParams.get("token")
    if (recoveryToken === null) throw new Error("The captured recovery email did not contain a token.")
    await page.goto(`${new URL(page.url()).origin}${recoveryUrl.pathname}${recoveryUrl.search}`)
    await page.reload()
    expect(await page.locator("body").textContent()).not.toContain(recoveryToken)
    await page.getByLabel("New password", { exact: true }).fill(recoveryPassword)
    await page.getByLabel("Confirm new password", { exact: true }).fill(recoveryPassword)
    await page.getByRole("button", { name: "Set new password", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Your password was changed", exact: true })).toBeVisible()
    expect(page.url()).not.toContain(recoveryToken)
    await secretAbsent(recoveryToken)

    await page.goto("/login/password?return_to=%2Faccount%2Fprofile")
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(recoveryPassword)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/mfa\?return_to=%2Faccount%2Fprofile$/)
    await page.getByRole("button", { name: /^Recovery code/ }).click()
    await page.getByLabel("Recovery code", { exact: true }).fill(fixture.recoveryCode)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page).toHaveURL(/\/account\/profile$/)
    await page.reload()
    await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("E2E Member")

    const accountPassword = "E2E Account Password 456!"
    await page.goto("/account/password")
    await page.reload()
    await page.getByLabel("Current password", { exact: true }).fill(recoveryPassword)
    await page.getByLabel("New password", { exact: true }).fill(accountPassword)
    await page.getByLabel("Confirm new password", { exact: true }).fill(accountPassword)
    await page.getByRole("button", { name: "Change password", exact: true }).click()
    await expect(page.getByRole("status")).toContainText("Your password was changed.")

    await page.goto("/account/email")
    await page.reload()
    await expect(page.getByText(fixture.member.email, { exact: true })).toBeVisible()

    await page.goto("/account/organizations")
    await page.reload()
    await expect(page.getByRole("heading", { name: fixture.organization.name, exact: true })).toBeVisible()
    const secondaryOrganization = page.locator("article").filter({ hasText: fixture.secondaryOrganization.name })
    await expect(secondaryOrganization).toBeVisible()
    const organizationSwitchResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/me/organizations/switch"),
    )
    await secondaryOrganization.getByRole("button", { name: "Switch organization", exact: true }).click()
    expect((await organizationSwitchResponsePromise).status()).toBe(200)
    await expect(page.getByRole("heading", { name: fixture.secondaryOrganization.name, exact: true })).toBeVisible()
    await expect.poll(() => new URL(page.url()).searchParams.get("organization")).toBe(fixture.secondaryOrganization.id)
    await page.reload()
    await expect(secondaryOrganization.getByText("Active organization", { exact: true })).toBeVisible()

    await page.goto("/account/sessions")
    await page.reload()
    const revocableSession = page
      .locator("article")
      .filter({ has: page.getByRole("button", { name: "Revoke session", exact: true }) })
      .first()
    await expect(revocableSession).toBeVisible()
    page.once("dialog", (dialog) => void dialog.accept())
    await revocableSession.getByRole("button", { name: "Revoke session", exact: true }).click()
    await expect(revocableSession).toHaveCount(0)

    await page.goto("/admin/users")
    await expect(page.locator("[data-content-state='inaccessible']")).toBeVisible()
    for (const secret of [
      accountPassword,
      fixture.member.password,
      fixture.recoveryCode,
      recoveryPassword,
      registeredPassword,
    ]) {
      await secretAbsent(secret)
    }
  } finally {
    await e2eServerStop(server.process)
  }
})

async function composedApiProxyInstall(page: Page, fixture: E2eServerMetadata): Promise<void> {
  await page.route("**/*", async (route) => {
    const browserUrl = new URL(route.request().url())
    if (browserUrl.pathname !== "/organization-discovery" && !browserUrl.pathname.startsWith("/realms/")) {
      await route.continue()
      return
    }

    const headers = new Headers(route.request().headers())
    headers.delete("content-length")
    headers.delete("x-e2e-origin")
    headers.set("host", new URL(fixture.origin).host)
    headers.set("origin", fixture.origin)
    const target = new URL(`${fixture.serverOrigin}${browserUrl.pathname}${browserUrl.search}`)
    if (browserUrl.pathname === "/organization-discovery") target.searchParams.set("domain", fixture.discoveryDomain)
    const response = await fetch(target, {
      body: route.request().postData() ?? undefined,
      headers,
      method: route.request().method(),
    })
    await route.fulfill({
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
    })
  })
}

async function e2eServerStart(): Promise<{
  readonly metadata: E2eServerMetadata
  readonly process: ChildProcess
  readonly recoveryLinkGet: () => Promise<string>
  readonly verificationLinkGet: () => Promise<string>
}> {
  const child = spawn("bun", ["e2e/authworksAdvancedE2eServer.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "inherit"],
  })
  return new Promise((resolve, reject) => {
    if (child.stdout === null) {
      reject(new Error("The advanced E2E server output was not available."))
      return
    }
    let buffer = ""
    let ready = false
    let metadata: E2eServerMetadata | undefined
    let verificationLinkResolve: ((link: string) => void) | undefined
    let verificationLinkReject: ((error: Error) => void) | undefined
    let recoveryLinkResolve: ((link: string) => void) | undefined
    let recoveryLinkReject: ((error: Error) => void) | undefined
    const verificationLink = new Promise<string>((linkResolve, linkReject) => {
      verificationLinkResolve = linkResolve
      verificationLinkReject = linkReject
    })
    const recoveryLink = new Promise<string>((linkResolve, linkReject) => {
      recoveryLinkResolve = linkResolve
      recoveryLinkReject = linkReject
    })
    const lineRead = (line: string) => {
      if (line.length === 0) return
      if (line.startsWith("ERROR ")) {
        const error = new Error(line.slice("ERROR ".length))
        verificationLinkReject?.(error)
        recoveryLinkReject?.(error)
        reject(error)
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch (_error) {
        return
      }
      if (typeof parsed !== "object" || parsed === null) return
      if ("ready" in parsed && parsed.ready === true) {
        metadata = parsed as unknown as E2eServerMetadata
        ready = true
        resolve({
          metadata,
          process: child,
          recoveryLinkGet: () => recoveryLink,
          verificationLinkGet: () => verificationLink,
        })
        return
      }
      if (ready && "verificationLink" in parsed && typeof parsed.verificationLink === "string")
        verificationLinkResolve?.(parsed.verificationLink)
      if (ready && "recoveryLink" in parsed && typeof parsed.recoveryLink === "string")
        recoveryLinkResolve?.(parsed.recoveryLink)
    }
    child.stdout.on("data", (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let newline = buffer.indexOf("\n")
      while (newline >= 0) {
        lineRead(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf("\n")
      }
    })
    child.once("error", (error) => {
      verificationLinkReject?.(error)
      recoveryLinkReject?.(error)
      reject(error)
    })
    child.once("exit", (code) => {
      if (!ready && code !== null && code !== 0) {
        const error = new Error(`The advanced E2E server exited with status ${code}.`)
        verificationLinkReject?.(error)
        recoveryLinkReject?.(error)
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
