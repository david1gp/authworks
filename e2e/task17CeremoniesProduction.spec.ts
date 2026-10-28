import { type ChildProcess, spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import { type BrowserContext, expect, type Page } from "@playwright/test"
import { e2eBrowserConsoleTest as test } from "./harness/e2eBrowserConsoleTest.js"

type E2eServerMetadata = {
  readonly member: { readonly email: string; readonly password: string }
  readonly origin: string
  readonly recoveryCode: string
  readonly realm: { readonly id: string }
  readonly serverOrigin: string
}

// The WebAuthn ceremony binds to rpId "localhost", so the page must load from a
// localhost origin. Pin localhost to the Playwright-managed IPv4 Vite server: this
// shared machine has a stray IPv6 listener on port 5174 that would otherwise win
// the connection race nondeterministically.
test.use({ launchOptions: { args: ["--host-resolver-rules=MAP localhost 127.0.0.1"] } })

test("task 17 composed production ceremonies complete passkeys and TOTP without persisting secrets", async ({
  baseURL,
  context,
  page,
}) => {
  test.setTimeout(240_000)
  const browserUrl = new URL(baseURL ?? "http://127.0.0.1:5174")
  browserUrl.hostname = "localhost"
  const browserOrigin = browserUrl.origin
  const server = await e2eServerStart(browserOrigin)
  const fixture = server.metadata
  const cdp = await context.newCDPSession(page)
  await cdp.send("WebAuthn.enable", { enableUI: false })
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      automaticPresenceSimulation: true,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: "ctap2",
      transport: "internal",
    },
  })
  const safeResponseBodies: Array<Promise<string>> = []
  const requestUrls: string[] = []
  let collectSafeResponses = false
  page.on("request", (request) => requestUrls.push(request.url()))
  page.on("response", (response) => {
    if (!collectSafeResponses || !new URL(response.url()).pathname.startsWith("/realms/")) return
    safeResponseBodies.push(response.text().catch(() => ""))
  })

  try {
    await composedApiProxyInstall(page, fixture)
    await page.goto(`${browserOrigin}/login/password`)
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.member.password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/login\/mfa/)
    await page.getByRole("button", { name: /^Recovery code/ }).click()
    await page.getByLabel("Recovery code", { exact: true }).fill(fixture.recoveryCode)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto(`${browserOrigin}/account#security`)
    // The authenticator and passkey lists live inside collapsed cards; expand them first.
    await page.locator("#security-factors summary").click()
    const securitySection = page.locator("#security-factors")
    // With one enrolled authenticator the remove trigger opens a rename dialog holding the remove button.
    // The dialog content portals outside the section, so scope it to the page.
    await expect(securitySection.getByRole("button", { name: /Authenticator app/ })).toBeVisible()
    await securitySection.getByRole("button", { name: /Authenticator app/ }).click()
    const totpRenameDialog = page.getByRole("dialog", { name: "Authenticator app" })
    const totpRemoveButton = totpRenameDialog.getByRole("button", { name: "Remove authenticator", exact: true })
    await expect(totpRemoveButton).toBeVisible()
    const totpRemovePromise = page.waitForResponse(
      (response) => response.request().method() === "DELETE" && new URL(response.url()).pathname.endsWith("/mfa/totp"),
    )
    await totpRemoveButton.evaluate((element) => (element as HTMLElement).click())
    // Removal asks for the shared confirmation before the request is sent.
    const totpRemoveConfirmation = page.getByRole("alertdialog")
    await expect(totpRemoveConfirmation).toBeVisible()
    await totpRemoveConfirmation.getByRole("button", { name: "Continue", exact: true }).click()
    expect((await totpRemovePromise).status()).toBe(200)
    await expect(totpRemoveConfirmation).toHaveCount(0)
    // Dismiss any stuck dialog overlay before touching the card again.
    await page.keyboard.press("Escape")
    // Reload to clear any wedged dialog/focus state before starting enrollment.
    await page.reload()
    await page.locator("#security-factors summary").click()
    await expect(securitySection.getByRole("button", { name: "Add authenticator", exact: true })).toBeVisible()

    const enrollmentResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/mfa/totp/enroll"),
    )
    // The add trigger opens the enroll dialog the same shifting way as the rename dialog.
    await securitySection.getByRole("button", { name: "Add authenticator", exact: true }).click()
    const enrollmentResponse = await enrollmentResponsePromise
    const enrollmentBody = (await enrollmentResponse.json()) as { readonly secret: string }
    expect(enrollmentResponse.status()).toBe(200)
    expect(enrollmentBody.secret).toMatch(/^[A-Z2-7]{16,128}$/)
    const enrollmentCode = totpCodeCreate(enrollmentBody.secret, Math.floor(Date.now() / 30_000))
    await page
      .getByRole("dialog", { name: "Finish authenticator setup" })
      .getByLabel("Verification code", { exact: true })
      .fill(enrollmentCode)
    const enrollmentConfirmPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/mfa/totp/confirm"),
    )
    await page
      .getByRole("dialog", { name: "Finish authenticator setup" })
      .getByRole("button", { name: "Confirm" })
      .click()
    const enrollmentConfirm = await enrollmentConfirmPromise
    expect(enrollmentConfirm.status()).toBe(200)
    // The setup dialog closes itself on success; wait for it to disappear.
    await expect(page.getByRole("dialog", { name: "Finish authenticator setup" })).toHaveCount(0)
    // The confirm reload remounts the collapsed card; expand it again to see the new enrollment.
    await page.locator("#security-factors summary").click()
    await expect(securitySection.getByRole("button", { name: /Authenticator app/ })).toBeVisible()
    collectSafeResponses = true
    await page.reload()
    await page.locator("#security-factors summary").click()
    await expect(page.locator("#security-factors").getByRole("button", { name: /Authenticator app/ })).toBeVisible()
    await expect(page.locator("body")).not.toContainText(enrollmentBody.secret)
    await browserSecretAssert(page, context, enrollmentBody.secret, safeResponseBodies, requestUrls)
    await totpStepAdvanceWait()

    await page.goto(`${browserOrigin}/login/logout`)
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible()

    await page.goto(`${browserOrigin}/login/password`)
    await page.getByLabel("Username or email", { exact: true }).fill(fixture.member.email)
    await page.getByLabel("Password", { exact: true }).fill(fixture.member.password)
    const passwordLoginPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/password/login"),
    )
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    const passwordLogin = await passwordLoginPromise
    const passwordLoginBody = (await passwordLogin.json()) as {
      readonly challenge?: { readonly token?: string }
    }
    const totpChallengeToken = passwordLoginBody.challenge?.token
    if (totpChallengeToken === undefined) throw new Error("The TOTP login challenge token was not returned.")
    await expect(page).toHaveURL(/\/login\/mfa/)
    await page.getByRole("button", { name: /^Authenticator app/ }).click()
    await page
      .getByLabel("Verification code", { exact: true })
      .fill(totpCodeCreate(enrollmentBody.secret, Math.floor(Date.now() / 30_000)))
    const challengeCompletePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/mfa/challenge/complete"),
    )
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    const challengeComplete = await challengeCompletePromise
    expect(challengeComplete.status()).toBe(200)
    await expect(page).toHaveURL(/\/account$/)
    await page.reload()
    await page.goto(`${browserOrigin}/account#profile`)
    await expect(page.locator("#profile")).toContainText("E2E Member")

    await page.goto(`${browserOrigin}/account#security`)
    await page.locator("#security-passkeys summary").click()
    const securityPasskeysSection = page.locator("#security-passkeys")
    const registrationStartPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/passkeys/registration/start"),
    )
    const registrationCompletePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/passkeys/registration/complete"),
    )
    await securityPasskeysSection.getByRole("button", { name: "Add passkey", exact: true }).click()
    // Adding opens the confirmation dialog holding the inner submit button.
    await page
      .getByRole("dialog", { name: "Add passkey" })
      .getByRole("button", { name: "Add passkey", exact: true })
      .click()
    const registrationStart = await registrationStartPromise
    const registrationStartBody = (await registrationStart.json()) as {
      readonly options: { readonly rp: { readonly id: string }; readonly user: { readonly id: string } }
      readonly token: string
    }
    expect(registrationStart.status()).toBe(200)
    expect(registrationStartBody.options.rp.id).toBe("localhost")
    expect(registrationStartBody.options.user.id.length).toBeGreaterThan(0)
    const registrationComplete = await registrationCompletePromise
    expect(registrationComplete.status(), await registrationComplete.text()).toBe(200)
    // The add dialog closes itself once the ceremony completes.
    await expect(page.getByRole("dialog", { name: "Add passkey" })).toHaveCount(0)
    // Registration remounts the collapsed card; expand it again to see the new passkey.
    await page.locator("#security-passkeys summary").click()
    await expect(securityPasskeysSection.getByText("Device-bound passkey", { exact: true })).toBeVisible()
    await page.reload()
    await page.locator("#security-passkeys summary").click()
    await expect(page.locator("#security-passkeys").getByText("Device-bound passkey", { exact: true })).toBeVisible()

    await page.goto(`${browserOrigin}/login/logout`)
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible()

    await page.goto(`${browserOrigin}/login/passkey`)
    const authenticationStartPromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/passkeys/authentication/start"),
    )
    const authenticationCompletePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/passkeys/authentication/complete"),
    )
    await page.getByRole("button", { name: "Continue with passkey", exact: true }).click()
    const authenticationStart = await authenticationStartPromise
    const authenticationStartBody = (await authenticationStart.json()) as {
      readonly options: { readonly rpId?: string; readonly userVerification: string }
      readonly token: string
    }
    expect(authenticationStart.status()).toBe(200)
    expect(authenticationStartBody.options.rpId).toBe("localhost")
    expect(authenticationStartBody.options.userVerification).toBe("required")
    const authenticationComplete = await authenticationCompletePromise
    expect(authenticationComplete.status()).toBe(200)
    await expect(page).toHaveURL(/\/login\/mfa/)
    await page.getByRole("button", { name: /^Authenticator app/ }).click()
    await totpStepAdvanceWait()
    await page
      .getByLabel("Verification code", { exact: true })
      .fill(totpCodeCreate(enrollmentBody.secret, Math.floor(Date.now() / 30_000)))
    const passkeyMfaCompletePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/mfa/challenge/complete"),
    )
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    expect((await passkeyMfaCompletePromise).status()).toBe(200)
    await expect(page).toHaveURL(/\/account$/)
    await page.reload()
    await page.goto(`${browserOrigin}/account#profile`)
    await expect(page.locator("#profile")).toContainText("E2E Member")
    await browserSecretAssert(page, context, enrollmentBody.secret, safeResponseBodies, requestUrls)
    await browserSecretAssert(page, context, registrationStartBody.token, [], requestUrls)
    await browserSecretAssert(page, context, authenticationStartBody.token, [], requestUrls)
    await browserSecretAssert(page, context, totpChallengeToken, [], requestUrls)
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId })
    await page.close()
    await e2eServerStop(server.process)
  }
})

function totpCodeCreate(secret: string, counter: number): string {
  const key = totpBase32Decode(secret)
  const message = Buffer.alloc(8)
  let remainder = counter
  for (let index = 7; index >= 0; index -= 1) {
    message[index] = remainder % 256
    remainder = Math.floor(remainder / 256)
  }
  const digest = createHmac("sha1", key).update(message).digest()
  const offset = digest[digest.length - 1]! & 0x0f
  const value =
    ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!
  return String(value % 1_000_000).padStart(6, "0")
}

function totpBase32Decode(value: string): Buffer {
  let buffer = 0
  let bits = 0
  const output: number[] = []
  for (const character of value) {
    buffer = (buffer << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >>> bits) & 255)
    }
  }
  return Buffer.from(output)
}

async function totpStepAdvanceWait(): Promise<void> {
  const remaining = 30_000 - (Date.now() % 30_000)
  await new Promise<void>((resolve) => setTimeout(resolve, remaining + 100))
}

async function browserSecretAssert(
  page: Page,
  context: BrowserContext,
  secret: string,
  responseBodies: ReadonlyArray<Promise<string>>,
  requestUrls: readonly string[],
): Promise<void> {
  const responses = await Promise.all(responseBodies)
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  const browserCookies = (await context.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("\n")
  const browserText = (await page.locator("body").textContent()) ?? ""
  expect(browserStorage).not.toContain(secret)
  expect(browserCookies).not.toContain(secret)
  expect(browserText).not.toContain(secret)
  expect(responses.every((body) => !body.includes(secret))).toBe(true)
  expect(requestUrls.every((url) => !url.includes(secret))).toBe(true)
}

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
    if (browserUrl.pathname === "/organization-discovery") target.searchParams.set("domain", "login.e2e.authworks.test")
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

async function e2eServerStart(
  browserOrigin: string,
): Promise<{ readonly metadata: E2eServerMetadata; readonly process: ChildProcess }> {
  const child = spawn("bun", ["e2e/authworksAdvancedE2eServer.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, AUTHWORKS_E2E_BROWSER_CEREMONY: "1", AUTHWORKS_E2E_BROWSER_ORIGIN: browserOrigin },
    stdio: ["ignore", "pipe", "inherit"],
  })
  return new Promise((resolve, reject) => {
    if (child.stdout === null) {
      reject(new Error("The ceremony E2E server output was not available."))
      return
    }
    let buffer = ""
    child.stdout.on("data", (chunk: Buffer | string) => {
      buffer += chunk.toString()
      let newline = buffer.indexOf("\n")
      while (newline >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (line.startsWith("ERROR ")) {
          reject(new Error(line.slice("ERROR ".length)))
          return
        }
        try {
          const parsed = JSON.parse(line) as Partial<E2eServerMetadata> & { readonly ready?: boolean }
          if (parsed.ready === true) resolve({ metadata: parsed as E2eServerMetadata, process: child })
        } catch (_error) {
          // The server may emit diagnostic lines before its JSON metadata.
        }
        newline = buffer.indexOf("\n")
      }
    })
    child.once("error", reject)
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`The ceremony E2E server exited with status ${code}.`))
    })
  })
}

async function e2eServerStop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  child.kill("SIGTERM")
  await new Promise<void>((resolve) => child.once("exit", () => resolve()))
}
