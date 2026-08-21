import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { demoAdminMachineCredentials } from "../../demo/demoAdminMachineCredentials.js"
import { demoAdminMachineUsers } from "../../demo/demoAdminMachineUsers.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { MachineCredential } from "../public/machineCredentialSchema.js"
import type { MachineCredentialKind } from "../public/machineCredentialKindSchema.js"
import type { MachineUser } from "../public/machineUserSchema.js"
import type { MachineAdminAdapter } from "./machineAdminAdapter.js"

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

/** A deterministic, clearly fake secret so no demo screen ever suggests a usable credential. */
const demoSecretGenerate = () => `demo-secret-${demoResourceIdGenerate().replaceAll("-", "")}0000000000`

/**
 * Fixture-backed adapter. It performs no network access and derives every success, empty,
 * loading, error, denied, assurance, one-time, redacted, expired, and cross-tenant response
 * from the URL-selected fixture state so each demo destination is deterministic.
 */
export function machineAdminDemoAdapterCreate(fixtureState: () => DemoFixtureState): MachineAdminAdapter {
  const machineUsers = demoAdminMachineUsers.map((machineUser) => ({ ...machineUser }))
  const credentials = demoAdminMachineCredentials.map((credential) => ({ ...credential }))
  const timestamp = 1_755_782_400_000

  const gate = <T>(value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "error")
      return Promise.resolve(
        resultErrorCodedCreate(
          "machineAdminDemo",
          "The deterministic machine-user fixture failed.",
          "machine-users.read-failed",
        ),
      )
    if (state === "permission-denied")
      return Promise.resolve(
        resultErrorCodedCreate(
          "machineAdminDemo",
          "You do not have permission to perform this action.",
          "machine-users.forbidden",
        ),
      )
    if (state === "expired")
      return Promise.resolve(
        resultErrorCodedCreate(
          "machineAdminDemo",
          "A stronger, more recent sign-in is required.",
          "authorization.insufficient-assurance",
        ),
      )
    if (state === "cross-tenant")
      return Promise.resolve(
        resultErrorCodedCreate(
          "machineAdminDemo",
          "This resource belongs to a different realm.",
          "machine-users.tenant-mismatch",
        ),
      )
    return Promise.resolve(value())
  }
  const collection = <T>(items: readonly T[]) =>
    gate(() => resultCreate({ items: fixtureState() === "empty" ? [] : [...items] }))

  const credentialIssue = (machineUserId: string, kind: MachineCredentialKind, input: MachineCredentialInput) =>
    gate(() => {
      const machineUser = machineUsers.find((item) => item.id === machineUserId)
      if (machineUser === undefined)
        return resultErrorCodedCreate("machineAdminDemo", "The machine user was not found.", "machine-users.not-found")
      const credential: MachineCredential = {
        createdAt: timestamp,
        ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
        id: demoResourceIdGenerate(),
        kind,
        machineUserId,
        name: input.name,
        realmId: demoRealmId,
        scopes: input.scopes === undefined ? [...machineUser.scopes] : [...input.scopes],
      }
      credentials.push(credential)
      return resultCreate({ credential, secret: demoSecretGenerate() })
    })

  return {
    apiKeyCreate: (machineUserId, input) => credentialIssue(machineUserId, "api_key", input),
    clientSecretRotate: (machineUserId) =>
      gate(() => {
        const index = machineUsers.findIndex((item) => item.id === machineUserId)
        const existing = machineUsers[index]
        if (existing === undefined)
          return resultErrorCodedCreate(
            "machineAdminDemo",
            "The machine user was not found.",
            "machine-users.not-found",
          )
        const updated = { ...existing, updatedAt: timestamp }
        machineUsers[index] = updated
        return resultCreate({
          clientId: updated.userName,
          clientSecret: demoSecretGenerate(),
          machineUser: updated,
        })
      }),
    credentialList: (machineUserId) => collection(credentials.filter((item) => item.machineUserId === machineUserId)),
    credentialRevoke: (credentialId) =>
      gate(() => {
        const index = credentials.findIndex((item) => item.id === credentialId)
        const existing = credentials[index]
        if (existing === undefined)
          return resultErrorCodedCreate("machineAdminDemo", "The credential was not found.", "machine-users.not-found")
        const updated: MachineCredential = { ...existing, revokedAt: timestamp }
        credentials[index] = updated
        return resultCreate(updated)
      }),
    machineUserCreate: (input) =>
      gate(() => {
        const machineUser: MachineUser = {
          createdAt: timestamp,
          displayName: input.displayName,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          scopes: input.scopes === undefined ? [] : [...input.scopes],
          status: "active",
          updatedAt: timestamp,
          userName: input.userName,
        }
        machineUsers.push(machineUser)
        return resultCreate({
          clientId: machineUser.userName,
          clientSecret: demoSecretGenerate(),
          machineUser,
        })
      }),
    machineUserGet: (machineUserId) =>
      gate(() => {
        const machineUser = machineUsers.find((item) => item.id === machineUserId)
        if (machineUser === undefined)
          return resultErrorCodedCreate(
            "machineAdminDemo",
            "The machine user was not found.",
            "machine-users.not-found",
          )
        return resultCreate(machineUser)
      }),
    machineUserLifecycleSet: (machineUserId, input) =>
      gate(() => {
        const index = machineUsers.findIndex((item) => item.id === machineUserId)
        const existing = machineUsers[index]
        if (existing === undefined)
          return resultErrorCodedCreate(
            "machineAdminDemo",
            "The machine user was not found.",
            "machine-users.not-found",
          )
        const updated = { ...existing, status: input.status, updatedAt: timestamp }
        machineUsers[index] = updated
        return resultCreate(updated)
      }),
    machineUserList: () => collection(machineUsers),
    personalAccessTokenCreate: (machineUserId, input) => credentialIssue(machineUserId, "personal_access_token", input),
  }
}

type MachineCredentialInput = {
  readonly expiresAt?: number
  readonly name: string
  readonly scopes?: readonly string[]
}
