import { expect, type ConsoleMessage, type Page, type Request, type Response, type TestInfo } from "@playwright/test"
import { httpDiagnosticPathCreate } from "../src/platform/http/httpDiagnosticPathCreate.js"
import { productionAuthTest } from "./productionAuthTest.js"

const productionOrigin = "https://authworks.contentoren.de"

type ProductionAccountApiEvidence = {
  readonly path: RegExp
}

type ProductionAccountTab = {
  readonly apiEvidence: readonly ProductionAccountApiEvidence[]
  readonly content: string | RegExp
  readonly heading: string
  readonly href: string
  readonly label: string
}

const accountTabs: readonly ProductionAccountTab[] = [
  {
    apiEvidence: [{ path: /\/me$/ }],
    content: "Sign-in details",
    heading: "Account",
    href: "/account",
    label: "Overview",
  },
  {
    apiEvidence: [{ path: /\/me$/ }],
    content: "Personal information",
    heading: "Profile",
    href: "/account/profile",
    label: "Profile",
  },
  {
    apiEvidence: [{ path: /\/me$/ }, { path: /\/me\/emails$/ }],
    content: "Email address and verification",
    heading: "Email address",
    href: "/account/email",
    label: "Email address",
  },
  {
    apiEvidence: [{ path: /\/me\/organizations$/ }],
    content: "Choose which organization you are working in.",
    heading: "My organizations",
    href: "/account/organizations",
    label: "Organizations",
  },
  {
    apiEvidence: [{ path: /\/me$/ }],
    content: "Change password",
    heading: "Password",
    href: "/account/password",
    label: "Password",
  },
  {
    apiEvidence: [{ path: /\/me\/sessions$/ }],
    content: "Review devices where your account is signed in and revoke any session you do not recognize.",
    heading: "Sessions and devices",
    href: "/account/sessions",
    label: "Sessions and devices",
  },
  {
    apiEvidence: [{ path: /\/passkeys$/ }],
    content: "Passkeys use your device screen lock or security key for secure sign-in.",
    heading: "Passkeys",
    href: "/account/passkeys",
    label: "Passkeys",
  },
  {
    apiEvidence: [{ path: /\/me\/authentication-methods$/ }],
    content: "Review the authentication methods available to your account and manage your authenticator app.",
    heading: "Multi-factor authentication",
    href: "/account/factors",
    label: "Multi-factor authentication",
  },
  {
    apiEvidence: [{ path: /\/me\/authentication-methods$/ }],
    content: "Recovery access",
    heading: "Recovery codes",
    href: "/account/recovery-codes",
    label: "Recovery codes",
  },
  {
    apiEvidence: [{ path: /\/me\/external-identities$/ }, { path: /\/me\/external-identity-providers$/ }],
    content: "External accounts linked to your Authworks identity. Unlink accounts you no longer use.",
    heading: "Linked identities",
    href: "/account/identities",
    label: "Linked identities",
  },
  {
    apiEvidence: [{ path: /\/me\/refresh-tokens$/ }],
    content:
      "Review the applications using refresh tokens for this account. Only safe metadata is shown; revoking a family also invalidates its access tokens.",
    heading: "Refresh tokens",
    href: "/account/refresh-tokens",
    label: "Refresh tokens",
  },
  {
    apiEvidence: [{ path: /\/me\/security-history$/ }],
    content:
      "Review recent security activity for this account. Sensitive event details and identifiers are never shown.",
    heading: "Security history",
    href: "/account/security-history",
    label: "Security history",
  },
  {
    apiEvidence: [{ path: /\/me\/consents$/ }],
    content:
      /Applications that can access information from your account\.|No applications have access to this account\./,
    heading: "Application consents",
    href: "/account/consents",
    label: "Application consents",
  },
  {
    apiEvidence: [{ path: /\/me\/effective-access$/ }],
    content:
      /Review the active organizations, projects, roles, and permissions available to this account\.|This account has no active organization or project access\./,
    heading: "Effective access",
    href: "/account/effective-access",
    label: "Effective access",
  },
  {
    apiEvidence: [{ path: /\/me$/ }],
    content: "Danger zone",
    heading: "Delete account",
    href: "/account/delete",
    label: "Delete account",
  },
]

type ProductionResponseDiagnostic = {
  readonly method: string
  readonly phase: "account" | "before-sign-in"
  readonly path: string
  readonly requestId?: string
  readonly sequence: number
  readonly status: number
}

type ProductionRequestFailureDiagnostic = {
  readonly method: string
  readonly path: string
  readonly sequence: number
}

type ProductionInvalidResponseDiagnostic = {
  readonly event: "authworks.api.invalid-response"
  readonly op?: string
  readonly path: string
  readonly reason: "invalid-json" | "invalid-schema" | "unexpected-304"
  readonly requestId?: string
  readonly schema: readonly { readonly code: string; readonly path: string }[]
  readonly status: number
}

type ProductionConsoleDiagnostic =
  | { readonly kind: "console-error" }
  | { readonly diagnostic: ProductionInvalidResponseDiagnostic; readonly kind: "invalid-response" }
  | { readonly kind: "native-network"; readonly status: number }

function productionAccountDiagnosticsCreate(page: Page) {
  const responses: ProductionResponseDiagnostic[] = []
  const requestFailures: ProductionRequestFailureDiagnostic[] = []
  const consoleDiagnostics: ProductionConsoleDiagnostic[] = []
  let pageErrorCount = 0
  const pendingRecords = new Set<Promise<void>>()
  let phase: ProductionResponseDiagnostic["phase"] = "before-sign-in"
  let sequence = 0

  const isApiRequest = (request: Request) => {
    if (request.resourceType() !== "fetch" && request.resourceType() !== "xhr") return false
    return new URL(request.url()).origin === productionOrigin
  }
  const responseRecord = async (response: Response, responsePhase: ProductionResponseDiagnostic["phase"]) => {
    if (!isApiRequest(response.request())) return
    const url = new URL(response.url())
    const responseSequence = ++sequence
    const requestId = productionAccountRequestIdGet(await response.headerValue("x-request-id"))
    responses.push({
      method: response.request().method(),
      phase: responsePhase,
      path: httpDiagnosticPathCreate(url),
      ...(requestId === undefined ? {} : { requestId }),
      sequence: responseSequence,
      status: response.status(),
    })
  }
  const responseObserve = (response: Response) => {
    const record = responseRecord(response, phase).catch(() => {
      consoleDiagnostics.push({ kind: "console-error" })
    })
    pendingRecords.add(record)
    void record.finally(() => pendingRecords.delete(record))
  }
  page.on("response", responseObserve)
  page.on("requestfailed", (request: Request) => {
    if (!isApiRequest(request)) return
    requestFailures.push({
      method: request.method(),
      path: httpDiagnosticPathCreate(request.url()),
      sequence: ++sequence,
    })
  })
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return
    const nativeStatus = productionAccountNativeNetworkErrorStatusGet(message.text())
    if (nativeStatus !== undefined) {
      consoleDiagnostics.push({ kind: "native-network", status: nativeStatus })
      return
    }
    const record = productionAccountConsoleDiagnosticRead(message).then((diagnostic) => {
      consoleDiagnostics.push(
        diagnostic === undefined ? { kind: "console-error" } : { diagnostic, kind: "invalid-response" },
      )
    })
    pendingRecords.add(record)
    void record.finally(() => pendingRecords.delete(record))
  })
  page.on("pageerror", () => {
    pageErrorCount += 1
  })

  const flush = async () => {
    await Promise.all([...pendingRecords])
  }
  const snapshotCreate = () => ({
    consoleErrors: [...consoleDiagnostics],
    unexpectedConsoleErrors: productionAccountUnexpectedConsoleErrors(consoleDiagnostics, responses),
    pageErrors: pageErrorCount,
    requestFailures: [...requestFailures].sort((left, right) => left.sequence - right.sequence),
    responses: [...responses].sort((left, right) => left.sequence - right.sequence),
    unexpectedResponses: responses
      .filter((response) => response.status < 200 || response.status >= 300)
      .filter((response) => !productionAccountResponseExpected(response))
      .sort((left, right) => left.sequence - right.sequence),
  })
  const snapshot = snapshotCreate
  const responsesSince = (sequenceBefore: number) =>
    snapshot().responses.filter((response) => response.sequence > sequenceBefore)
  const failureMessage = (tab: string) =>
    `Production account regression diagnostics after ${tab}:\n${JSON.stringify(snapshot(), null, 2)}`
  const attach = async (testInfo: TestInfo) => {
    await flush()
    await testInfo.attach("production-account-response-diagnostics", {
      body: Buffer.from(JSON.stringify(snapshot(), null, 2)),
      contentType: "application/json",
    })
  }

  const accountPhaseMark = () => {
    phase = "account"
  }

  return {
    accountPhaseMark,
    attach,
    failureMessage,
    flush,
    responseSequenceMark: () => sequence,
    responsesSince,
    snapshot,
  }
}

function productionAccountResponseExpected(response: ProductionResponseDiagnostic) {
  if (
    response.phase === "before-sign-in" &&
    response.status === 401 &&
    (response.path.endsWith("/sessions/current") || response.path.endsWith("/sessions/recent"))
  )
    return true
  return response.phase === "account" && response.status === 403 && response.path === "/realms/[redacted]"
}

function productionAccountUnexpectedConsoleErrors(
  consoleDiagnostics: readonly ProductionConsoleDiagnostic[],
  responses: readonly ProductionResponseDiagnostic[],
) {
  const expectedResourceErrorCountByStatus = new Map<number, number>()
  for (const response of responses) {
    if (!productionAccountResponseExpected(response)) continue
    const current = expectedResourceErrorCountByStatus.get(response.status) ?? 0
    expectedResourceErrorCountByStatus.set(response.status, current + 1)
  }
  return consoleDiagnostics.filter((diagnostic) => {
    if (diagnostic.kind !== "native-network") return true
    const status = diagnostic.status
    const expected = expectedResourceErrorCountByStatus.get(status) ?? 0
    if (expected === 0) return true
    expectedResourceErrorCountByStatus.set(status, expected - 1)
    return false
  })
}

function productionAccountRequestIdGet(value: string | null): string | undefined {
  return value !== null && /^[a-z0-9._:-]{1,128}$/i.test(value) ? value : undefined
}

async function productionAccountConsoleDiagnosticRead(
  message: ConsoleMessage,
): Promise<ProductionInvalidResponseDiagnostic | undefined> {
  for (const argument of message.args()) {
    let value: unknown
    try {
      value = await argument.jsonValue()
    } catch (_error) {
      continue
    }
    const diagnostic = productionAccountInvalidResponseDiagnosticCreate(value)
    if (diagnostic !== undefined) return diagnostic
  }
  return undefined
}

function productionAccountInvalidResponseDiagnosticCreate(
  value: unknown,
): ProductionInvalidResponseDiagnostic | undefined {
  if (value === null || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  if (record.event !== "authworks.api.invalid-response" || typeof record.path !== "string") return undefined
  if (record.reason !== "invalid-json" && record.reason !== "invalid-schema" && record.reason !== "unexpected-304")
    return undefined
  if (typeof record.status !== "number" || !Number.isSafeInteger(record.status)) return undefined
  const schema = Array.isArray(record.schema)
    ? record.schema.slice(0, 20).flatMap((entry) => {
        if (entry === null || typeof entry !== "object") return []
        const issue = entry as Record<string, unknown>
        if (typeof issue.code !== "string" || typeof issue.path !== "string") return []
        return [
          {
            code: /^[a-z][a-z0-9_.-]{0,63}$/i.test(issue.code) ? issue.code : "unknown",
            path: productionAccountSchemaPathCreate(issue.path),
          },
        ]
      })
    : []
  const op = typeof record.op === "string" && /^[a-z][a-z0-9_.-]{0,127}$/i.test(record.op) ? record.op : undefined
  const requestId = productionAccountRequestIdGet(typeof record.requestId === "string" ? record.requestId : null)
  return {
    event: "authworks.api.invalid-response",
    ...(op === undefined ? {} : { op }),
    path: httpDiagnosticPathCreate(record.path),
    reason: record.reason,
    ...(requestId === undefined ? {} : { requestId }),
    schema,
    status: record.status,
  }
}

function productionAccountNativeNetworkErrorStatusGet(value: string): number | undefined {
  const match = /^Failed to load resource: the server responded with a status of (\d+) \(\)$/.exec(value)
  if (match === null) return undefined
  const status = Number(match[1])
  return Number.isSafeInteger(status) ? status : undefined
}

function productionAccountSchemaPathCreate(value: string): string {
  return value
    .split(".")
    .map((segment) => (/^(?:[a-z][a-z0-9_.-]{0,63}|[0-9]+)$/i.test(segment) ? segment : "[redacted]"))
    .join(".")
}

async function productionAccountTabVerify(
  page: Page,
  diagnostics: ReturnType<typeof productionAccountDiagnosticsCreate>,
  tab: ProductionAccountTab,
  sequenceBefore: number,
) {
  const message = diagnostics.failureMessage(tab.href)
  await expect(page).toHaveURL(`${productionOrigin}${tab.href}`)
  await expect(page.locator("main h1").first(), message).toHaveText(tab.heading)
  await expect(page.locator("main").getByText(tab.content).first(), message).toBeVisible()
  await expect(page.locator('[data-content-state="loading"], [role="status"]'), message).toHaveCount(0)
  await diagnostics.flush()

  const responses = diagnostics.responsesSince(sequenceBefore)
  for (const evidence of tab.apiEvidence) {
    expect(
      responses.some(
        (response) => evidence.path.test(response.path) && response.status >= 200 && response.status < 300,
      ),
      message,
    ).toBe(true)
  }
  await expect(page.locator('[data-content-state="error"]'), message).toHaveCount(0)
  await expect(page.getByRole("alert"), message).toHaveCount(0)
  await expect(page.getByText(/invalid response/i), message).toHaveCount(0)
  expect(diagnostics.snapshot().unexpectedResponses, message).toEqual([])
  expect(diagnostics.snapshot().requestFailures, message).toEqual([])
  expect(diagnostics.snapshot().unexpectedConsoleErrors, message).toEqual([])
  expect(diagnostics.snapshot().pageErrors, message).toBe(0)
}

productionAuthTest("authenticated production account tabs remain valid", async ({ page, productionAuth }, testInfo) => {
  testInfo.setTimeout(180_000)
  const diagnostics = productionAccountDiagnosticsCreate(page)
  try {
    await productionAuth.signIn(page)
    diagnostics.accountPhaseMark()
    await expect(page).toHaveURL(`${productionOrigin}/account`)
    await page.goto(`${productionOrigin}/account`)
    await page.reload()
    await expect(page).toHaveURL(`${productionOrigin}/account`)

    const navigation = page.locator("nav").first()
    await expect(navigation).toHaveCount(1)
    for (const tab of accountTabs) {
      const link = navigation.getByRole("link", { exact: true, name: tab.label })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute("href", tab.href)
      const retainedSequenceBefore = tab.href === "/account" ? 0 : diagnostics.responseSequenceMark()
      if (tab.href !== "/account") await link.click()
      await expect(link).toHaveAttribute("aria-current", "page")
      await productionAccountTabVerify(page, diagnostics, tab, retainedSequenceBefore)

      const reloadSequenceBefore = diagnostics.responseSequenceMark()
      await page.reload()
      await expect(link).toHaveAttribute("aria-current", "page")
      await productionAccountTabVerify(page, diagnostics, tab, reloadSequenceBefore)
    }
  } finally {
    await diagnostics.attach(testInfo)
  }
})
