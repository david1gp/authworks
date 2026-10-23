import { createResult, createResultError, type Result } from "#result"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { realmApiClientCreate } from "../../src/features/realms/client/realmApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"

const serviceUserName = "authworks-e2e-service"

const serviceUserEmail = "authworks-e2e-service@contentoren.de"

const serviceUserDisplayName = "Authworks E2E Service"

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
  if (options.baseUrl.length === 0) return Promise.resolve(createResultError(op, "The API origin is required."))
  if (options.systemSecret.length === 0) return Promise.resolve(createResultError(op, "The system secret is required."))
  if (options.password.length === 0)
    return Promise.resolve(createResultError(op, "The service-user password is required."))
  if (!URL.canParse(options.baseUrl)) return Promise.resolve(createResultError(op, "The API origin is invalid."))
  if (options.realmId !== undefined && options.realmId.length === 0)
    return Promise.resolve(createResultError(op, "The realm id is invalid."))
  if (options.realmDomain !== undefined && options.realmDomain.length === 0)
    return Promise.resolve(createResultError(op, "The realm domain is invalid."))

  const realms = realmApiClientCreate({ baseUrl: options.baseUrl, token: options.systemSecret })
  const users = userApiClientCreate({ baseUrl: options.baseUrl, systemToken: options.systemSecret })
  const passwords = passwordApiClientCreate({ baseUrl: options.baseUrl, systemToken: options.systemSecret })

  const realmIdResolve = async (): Promise<Result<string>> => {
    if (options.realmId !== undefined && options.realmId.length > 0) return createResult(options.realmId)
    const listed = await realms.realmList({ pageSize: 100 })
    if (!listed.success) return listed
    if (listed.data.items.length === 0)
      return createResultError(op, "No realm exists. Create a realm before provisioning the service user.")
    const domain = options.realmDomain === undefined ? undefined : options.realmDomain.trim().toLowerCase()
    if (domain !== undefined && domain.length > 0) {
      const match = listed.data.items.find(
        (item) => item.domain === domain || item.domains.some((candidate) => candidate === domain),
      )
      if (match === undefined) return createResultError(op, `No realm serves the domain "${options.realmDomain}".`)
      return createResult(match.id)
    }
    if (listed.data.items.length > 1)
      return createResultError(
        op,
        "Multiple realms exist. Pass --realm-domain to select the realm for the service user.",
      )
    const realmId = listed.data.items[0]?.id
    if (realmId === undefined) return createResultError(op, "No realm exists.")
    return createResult(realmId)
  }

  const findByUserName = async (realmId: string, userName: string) => {
    let pageToken: string | undefined
    for (let page = 0; page < 20; page += 1) {
      const listed = await users.userList(realmId, {
        pageSize: 100,
        ...(pageToken === undefined ? {} : { pageToken }),
        search: userName,
      })
      if (!listed.success) return listed
      const match = listed.data.items.find((item) => item.userName === userName)
      if (match !== undefined) return createResult(match)
      const next = listed.data.nextPageToken
      if (next === undefined || next.length === 0) return createResult(null)
      pageToken = next
    }
    return createResultError(op, "The user search did not converge.")
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
      const created = await users.userCreate(realmId, {
        email: serviceUserEmail,
        profile: { displayName: serviceUserDisplayName },
        userName: serviceUserName,
      })
      if (!created.success) return created
      userId = created.data.user.id
    } else {
      userId = existing.data.id
      alreadyExisted = true
    }

    if (existing.data === null || existing.data.state === "initial") {
      const activated = await users.userLifecycleSet(realmId, userId, { state: "active" })
      if (!activated.success) return activated
    }
    if (existing.data === null || existing.data.verificationState !== "verified") {
      const verified = await users.userEmailVerificationSet(realmId, userId, { state: "verified" })
      if (!verified.success) return verified
    }

    const passwordSet = await passwords.passwordCredentialReplace(realmId, userId, { password: options.password })
    if (!passwordSet.success) return passwordSet

    const granted = await realms.realmAdministratorGrant(realmId, { userId })
    if (!granted.success) {
      const alreadyAdministrator = "code" in granted && granted.code === "realms.administrator-exists"
      if (!alreadyAdministrator) return granted
    }

    return createResult({ alreadyExisted, realmId, status: alreadyExisted ? "updated" : "created", userId })
  })().catch((error) => createResultError(op, errorMessageGet(error)))
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
