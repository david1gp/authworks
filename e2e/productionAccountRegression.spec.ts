import { expect, type ConsoleMessage, type Page, type Request, type Response, type TestInfo } from "@playwright/test"
import { httpDiagnosticPathCreate } from "../src/platform/http/httpDiagnosticPathCreate.js"
import { productionAuthTest } from "./productionAuthTest.js"

const productionOrigin = "https://authworks.contentoren.de"

type ProductionAccountApiEvidence = {
  readonly path: RegExp
}

type ProductionAccountSection = {
  readonly apiEvidence: readonly ProductionAccountApiEvidence[]
  readonly content: string | RegExp
  readonly heading: string
  readonly id: string
  readonly label: string
}

const accountSections: readonly ProductionAccountSection[] = [
  {
    apiEvidence: [{ path: /\/me$/ }, { path: /\/me\/emails$/ }],
    content: "Personal information",
    heading: "Profile",
    id: "profile",
    label: "Profile",
  },
  {
    apiEvidence: [
      { path: /\/me$/ },
      { path: /\/passkeys$/ },
      { path: /\/me\/authentication-methods$/ },
      { path: /\/me\/external-identities$/ },
      { path: /\/me\/external-identity-providers$/ },
      { path: /\/me\/security-history$/ },
    ],
    content: "Change password",
    heading: "Security",
    id: "security",
    label: "Security",
  },
  {
    apiEvidence: [{ path: /\/me\/sessions$/ }, { path: /\/me\/refresh-tokens$/ }, { path: /\/me\/consents$/ }],
    content: "Review devices where your account is signed in and revoke any session you do not recognize.",
    heading: "Sessions and devices · Applications",
    id: "devices-applications",
    label: "Sessions and devices",
  },
  {
    apiEvidence: [{ path: /\/me\/organizations$/ }, { path: /\/me\/effective-access$/ }],
    content: "Choose which organization you are working in.",
    heading: "Access",
    id: "access",
    label: "Access",
  },
  {
    apiEvidence: [{ path: /\/me$/ }],
    content: "Permanently delete this account",
    heading: "Danger zone",
    id: "danger-zone",
    label: "Danger zone",
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

async function productionAccountSectionVerify(
  page: Page,
  diagnostics: ReturnType<typeof productionAccountDiagnosticsCreate>,
  section: ProductionAccountSection,
  responses: readonly ProductionResponseDiagnostic[],
) {
  const message = diagnostics.failureMessage(`#${section.id}`)
  const workspaceSection = page.locator(`#${section.id}`)
  await expect(page).toHaveURL(`${productionOrigin}/account#${section.id}`)
  await expect(workspaceSection.getByRole("heading", { name: section.heading, exact: true }), message).toBeVisible()
  await expect(workspaceSection.getByText(section.content).first(), message).toBeVisible()
  await expect(page.locator('[data-content-state="loading"], [role="status"]'), message).toHaveCount(0)
  await diagnostics.flush()

  for (const evidence of section.apiEvidence) {
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

productionAuthTest(
  "authenticated production account workspace sections remain valid",
  async ({ page, productionAuth }, testInfo) => {
    testInfo.setTimeout(180_000)
    const diagnostics = productionAccountDiagnosticsCreate(page)
    try {
      await productionAuth.signIn(page)
      diagnostics.accountPhaseMark()
      await expect(page).toHaveURL(`${productionOrigin}/account`)
      const accountLoadSequenceBefore = diagnostics.responseSequenceMark()
      await page.goto(`${productionOrigin}/account`)
      await expect(page).toHaveURL(`${productionOrigin}/account`)

      const navigation = page.getByRole("navigation", { name: "Account navigation" })
      await expect(navigation).toBeVisible()
      await expect(page.locator("header").first()).toHaveCSS("position", "sticky")
      await expect(navigation).toHaveCSS("position", "sticky")
      await expect(page.getByText("Sign-in details", { exact: true })).toHaveCount(0)
      await diagnostics.flush()
      const accountResponses = diagnostics.responsesSince(accountLoadSequenceBefore)

      for (const section of accountSections) {
        const link = navigation.getByRole("link", { exact: true, name: section.label })
        await expect(link).toBeVisible()
        await expect(link).toHaveAttribute("href", `#${section.id}`)
        await link.click()
        await expect(link).toHaveAttribute("aria-current", "location")
        await productionAccountSectionVerify(page, diagnostics, section, accountResponses)
      }

      await page.reload()
      await expect(page).toHaveURL(`${productionOrigin}/account#danger-zone`)
      await expect(navigation.getByRole("link", { exact: true, name: "Danger zone" })).toHaveAttribute(
        "aria-current",
        "location",
      )
    } finally {
      await diagnostics.attach(testInfo)
    }
  },
)
