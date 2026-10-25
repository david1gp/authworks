import { createResult, type Result, type ResultErr } from "#result"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { passwordPolicyCheck } from "../../src/features/passwords/domain/passwordPolicyCheck.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"

const serviceUserName = "authworks-e2e-service"

const serviceUserEmail = "authworks-e2e-service@contentoren.de"

const serviceUserDisplayName = "Authworks E2E Service"

const failurePrefix = "e2e.service-user-ensure"

type ApiStage =
  | "realm-list"
  | "user-list"
  | "user-create"
  | "user-email-verification-set"
  | "user-lifecycle-set"
  | "password-policy-get"
  | "password-credential-replace"
  | "administrator-grant"

type E2eServiceUserEnsureOptions = {
  readonly baseUrl: string
  readonly password: string
  readonly realmDomain?: string
  readonly realmId?: string
  readonly systemSecret: string
}

type E2eServiceUserEnsured = {
  readonly alreadyExisted: boolean
  readonly realmId: string
  readonly status: "created" | "updated"
  readonly userId: string
}

export function e2eServiceUserEnsure(options: E2eServiceUserEnsureOptions): Promise<Result<E2eServiceUserEnsured>> {
  const op = "e2eServiceUserEnsure"
  if (options.baseUrl.length === 0)
    return Promise.resolve(failureCreate(op, "The API origin is required.", "input-invalid"))
  if (options.systemSecret.length === 0)
    return Promise.resolve(failureCreate(op, "The system secret is required.", "authorization-unavailable"))
  if (options.password.length === 0)
    return Promise.resolve(failureCreate(op, "The service-user password is required.", "input-invalid"))
  if (!URL.canParse(options.baseUrl))
    return Promise.resolve(failureCreate(op, "The API origin is invalid.", "input-invalid"))
  if (options.realmId !== undefined && options.realmId.length === 0)
    return Promise.resolve(failureCreate(op, "The realm id is invalid.", "input-invalid"))
  if (options.realmDomain !== undefined && options.realmDomain.length === 0)
    return Promise.resolve(failureCreate(op, "The realm domain is invalid.", "input-invalid"))

  const realms = realmApiClientCreate({ baseUrl: options.baseUrl, token: options.systemSecret })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, systemToken: options.systemSecret })
  const passwords = passwordApiClientCreate({ baseUrl: options.baseUrl, systemToken: options.systemSecret })

  const realmIdResolve = async (): Promise<Result<string>> => {
    if (options.realmId !== undefined && options.realmId.length > 0) return createResult(options.realmId)
    const listed = await apiStage(realms.realmList({ pageSize: 100 }), "realm-list")
    if (!listed.success) return listed
    if (listed.data.items.length === 0)
      return failureCreate(
        op,
        "No realm exists. Create a realm before provisioning the service user.",
        "realm-not-found",
      )
    const domain = options.realmDomain === undefined ? undefined : options.realmDomain.trim().toLowerCase()
    if (domain !== undefined && domain.length > 0) {
      const matches = listed.data.items.filter(
        (item) => item.domain === domain || item.domains.some((candidate) => candidate === domain),
      )
      if (matches.length === 0)
        return failureCreate(op, `No realm serves the domain "${options.realmDomain}".`, "realm-not-found")
      if (matches.length > 1)
        return failureCreate(op, `More than one realm serves the domain "${options.realmDomain}".`, "realm-ambiguous")
      const match = matches[0]
      if (match === undefined) return failureCreate(op, "No realm serves the configured domain.", "realm-not-found")
      if (match.status !== "active") return failureCreate(op, "The production realm is not active.", "realm-inactive")
      return createResult(match.id)
    }
    if (listed.data.items.length > 1)
      return failureCreate(
        op,
        "Multiple realms exist. Pass --realm-domain to select the realm for the service user.",
        "realm-ambiguous",
      )
    const realmId = listed.data.items[0]?.id
    if (realmId === undefined) return failureCreate(op, "No realm exists.", "realm-not-found")
    const only = listed.data.items[0]
    if (only !== undefined && only.status !== "active")
      return failureCreate(op, "The production realm is not active.", "realm-inactive")
    return createResult(realmId)
  }

  const findByUserName = async (realmId: string, userName: string) => {
    let pageToken: string | undefined
    for (let page = 0; page < 20; page += 1) {
      const listed = await apiStage(
        users.userList(realmId, {
          pageSize: 100,
          ...(pageToken === undefined ? {} : { pageToken }),
          search: userName,
        }),
        "user-list",
      )
      if (!listed.success) return listed
      const duplicates = listed.data.items.filter((item) => item.userName === userName)
      if (duplicates.length > 1)
        return failureCreate(op, "The service user name is ambiguous in this realm.", "user-ambiguous")
      const match = duplicates[0]
      if (match !== undefined) {
        if (match.email.trim().toLowerCase() !== serviceUserEmail)
          return failureCreate(op, "The service user name is taken by another account.", "user-conflict")
        if (match.realmId !== realmId)
          return failureCreate(op, "The service user belongs to another realm.", "user-conflict")
        return createResult(match)
      }
      const next = listed.data.nextPageToken
      if (next === undefined || next.length === 0) return createResult(null)
      pageToken = next
    }
    return failureCreate(op, "The user search did not converge.", "api-invalid-response.user-list")
  }

  return (async (): Promise<Result<E2eServiceUserEnsured>> => {
    const resolved = await realmIdResolve()
    if (!resolved.success) return resolved
    const realmId = resolved.data

    const existing = await findByUserName(realmId, serviceUserName)
    if (!existing.success) return existing

    let userId: string
    let alreadyExisted = false
    if (existing.data === null) {
      const created = await apiStage(
        users.userCreate(realmId, {
          email: serviceUserEmail,
          profile: { displayName: serviceUserDisplayName },
          userName: serviceUserName,
        }),
        "user-create",
      )
      if (!created.success) return created
      userId = created.data.user.id
    } else {
      userId = existing.data.id
      alreadyExisted = true
    }

    if (existing.data === null || existing.data.state === "initial") {
      const activated = await apiStage(
        users.userLifecycleSet(realmId, userId, { state: "active" }),
        "user-lifecycle-set",
      )
      if (!activated.success) return activated
    }
    if (existing.data === null || existing.data.verificationState !== "verified") {
      const verified = await apiStage(
        users.userEmailVerificationSet(realmId, userId, { state: "verified" }),
        "user-email-verification-set",
      )
      if (!verified.success) return verified
    }

    const policy = await apiStage(passwords.passwordPolicySystemGet(realmId), "password-policy-get")
    if (!policy.success) return policy
    const policyChecked = passwordPolicyCheck(options.password, policy.data.policy)
    if (!policyChecked.success)
      return failureCreate(
        op,
        "The service-user password does not meet the password policy.",
        "password-policy-rejected",
      )

    const passwordSet = await apiStage(
      passwords.passwordCredentialReplace(realmId, userId, { password: options.password }),
      "password-credential-replace",
    )
    if (!passwordSet.success) return passwordSet

    const grantRaw = await realms.realmAdministratorGrant(realmId, { userId })
    if (!grantRaw.success && grantRaw.code === "realms.administrator-exists")
      return grantResolved(realmId, userId, alreadyExisted)
    const granted = apiStage(grantRaw, "administrator-grant")
    if (!granted.success) return granted

    return createResult({ alreadyExisted, realmId, status: alreadyExisted ? "updated" : "created", userId })
  })().catch((error) => failureCreate(op, errorMessageGet(error), "api-failed"))
}

function grantResolved(realmId: string, userId: string, alreadyExisted: boolean): Result<E2eServiceUserEnsured> {
  return createResult({ alreadyExisted, realmId, status: alreadyExisted ? "updated" : "created", userId })
}

function apiStage<T>(result: Promise<Result<T>>, stage: ApiStage): Promise<Result<T>>
function apiStage<T>(result: Result<T>, stage: ApiStage): Result<T>
function apiStage<T>(result: Promise<Result<T>> | Result<T>, stage: ApiStage): Promise<Result<T>> | Result<T> {
  const op = "e2eServiceUserEnsure"
  const failureMap = (failure: ResultErr): ResultErr => {
    if (failure.code?.startsWith(`${failurePrefix}.`) === true) return failureDetailEnrich(failure, stage)
    if (
      failure.code === "platform.unauthorized" ||
      failure.code === "platform.forbidden" ||
      failure.statusCode === 401 ||
      failure.statusCode === 403
    )
      return resultErrorCodedCreate(
        op,
        failureDetailMessage(
          "The service-user ensure was not authorized.",
          `${failurePrefix}.api-unauthorized`,
          stage,
          failure.statusCode,
        ),
        `${failurePrefix}.api-unauthorized`,
      )
    if (failure.code === "platform.unreachable" || failure.code === "platform.unavailable")
      return resultErrorCodedCreate(
        op,
        failureDetailMessage(
          "The service-user ensure API is unreachable.",
          `${failurePrefix}.api-unreachable`,
          stage,
          failure.statusCode,
        ),
        `${failurePrefix}.api-unreachable`,
      )
    if (failure.code === "platform.rate-limited" || failure.statusCode === 429)
      return resultErrorCodedCreate(
        op,
        failureDetailMessage(
          "The service-user ensure API is rate limited.",
          `${failurePrefix}.api-rate-limited`,
          stage,
          failure.statusCode,
        ),
        `${failurePrefix}.api-rate-limited`,
      )
    if (
      failure.code !== undefined &&
      failure.code !== "platform.invalid-response" &&
      failure.code !== "platform.http" &&
      failure.code !== "platform.internal" &&
      failure.statusCode !== undefined &&
      failure.statusCode >= 400 &&
      failure.statusCode < 500 &&
      failure.code !== "users.already-exists" &&
      failure.code !== "users.conflict" &&
      failure.code !== "realms.administrator-exists"
    )
      return resultErrorCodedCreate(
        op,
        failureDetailMessage(
          "The server rejected the service-user ensure request.",
          `${failurePrefix}.api-rejected.${stage}`,
          stage,
          failure.statusCode,
        ),
        `${failurePrefix}.api-rejected.${stage}`,
      )
    if (failure.code === "platform.invalid-response")
      return resultErrorCodedCreate(
        op,
        failureDetailMessage(
          "The server returned an invalid response.",
          `${failurePrefix}.api-invalid-response.${stage}`,
          stage,
          failure.statusCode,
        ),
        `${failurePrefix}.api-invalid-response.${stage}`,
      )
    return resultErrorCodedCreate(
      op,
      failureDetailMessage(
        "The service-user ensure API call failed.",
        `${failurePrefix}.api-failed`,
        stage,
        failure.statusCode ?? failureDetailStatusGet(failure),
      ),
      `${failurePrefix}.api-failed`,
    )
  }
  if (result instanceof Promise) return result.then((resolved) => (resolved.success ? resolved : failureMap(resolved)))
  return result.success ? result : failureMap(result)
}

function failureDetailMessage(message: string, code: string, stage: ApiStage, status: number | undefined): string {
  const statusText = status === undefined ? "n/a" : `${status}`
  return `${message} [code=${code} stage=${stage} http=${statusText}]`
}

function failureDetailStatusGet(failure: ResultErr): number | undefined {
  const parsed = failureDetailErrorDataParse(failure.errorData)
  const status = parsed?.status
  return typeof status === "number" && Number.isSafeInteger(status) ? status : undefined
}

function failureDetailErrorDataParse(raw: string | null | undefined): { readonly status?: unknown } | undefined {
  if (raw === undefined || raw === null) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) return parsed as { readonly status?: unknown }
    return undefined
  } catch {
    return undefined
  }
}

function failureDetailEnrich(failure: ResultErr, stage: ApiStage): ResultErr {
  const status = failure.statusCode ?? failureDetailStatusGet(failure)
  const code = failure.code ?? `${failurePrefix}.api-failed`
  if (failure.errorMessage.includes("[code="))
    return failure.statusCode === undefined && status !== undefined ? { ...failure, statusCode: status } : failure
  const enriched = resultErrorCodedCreate(
    opOf(failure),
    `${failure.errorMessage} [code=${code} stage=${stage} http=${status === undefined ? "n/a" : `${status}`}]`,
    code,
  )
  if (status !== undefined) enriched.statusCode = status
  if (failure.errorData !== undefined && enriched.errorData === undefined) enriched.errorData = failure.errorData
  return enriched
}

function opOf(failure: ResultErr): string {
  return failure.op.length > 0 ? failure.op : "e2eServiceUserEnsure"
}

function failureCreate(op: string, errorMessage: string, suffix: string): ResultErr {
  const code = `${failurePrefix}.${suffix}`
  if (errorMessage.includes("[code=")) return resultErrorCodedCreate(op, errorMessage, code)
  return resultErrorCodedCreate(op, `${errorMessage} [code=${code}]`, code)
}

export function e2eServiceUserIdentityGet(): {
  readonly displayName: string
  readonly email: string
  readonly userName: string
} {
  return { displayName: serviceUserDisplayName, email: serviceUserEmail, userName: serviceUserName }
}

function errorMessageGet(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "The E2E service user could not be provisioned."
}
