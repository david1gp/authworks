import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import type { RealmAdministrator } from "../../realms/public/realmAdministratorSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryRealmAdministratorsAdapter } from "./directoryRealmAdministratorsAdapter.js"

const demoRealm = "01900000-0000-7000-8000-000000000001"
const day = 86_400_000
const now = 1_755_782_400_000

type DirectoryRealmAdminPersonFixture = {
  readonly createdBy?: string
  readonly displayName: string
  readonly email: string
  readonly id: string
  readonly userName: string
}

const administratorFixtures: readonly DirectoryRealmAdminPersonFixture[] = [
  {
    createdBy: "01900000-0000-7000-8000-000000000201",
    displayName: "Ada Osei",
    email: "ada.osei@acme.example",
    id: "01900000-0000-7000-8000-000000000101",
    userName: "ada.osei",
  },
  {
    createdBy: "01900000-0000-7000-8000-000000000101",
    displayName: "Juno Reyes",
    email: "juno.reyes@acme.example",
    id: "01900000-0000-7000-8000-000000000110",
    userName: "juno.reyes",
  },
  {
    displayName: "Hana Sato",
    email: "hana.sato@acme.example",
    id: "01900000-0000-7000-8000-000000000108",
    userName: "hana.sato",
  },
]

const administratorEntryCreate = (person: DirectoryRealmAdminPersonFixture, index: number): RealmAdministrator => ({
  ...(person.createdBy === undefined ? {} : { createdBy: person.createdBy }),
  createdAt: now - (30 - index * 9) * day,
  realmId: demoRealmId,
  user: { displayName: person.displayName, email: person.email, userName: person.userName },
  userId: person.id,
})

type DirectoryRealmAdminSearchFixture = {
  readonly displayName: string
  readonly email: string
  readonly id: string
  readonly userName: string
}

const searchableFixtures: readonly DirectoryRealmAdminSearchFixture[] = [
  ...administratorFixtures,
  {
    displayName: "Bruno Feld",
    email: "bruno.feld@acme.example",
    id: "01900000-0000-7000-8000-000000000102",
    userName: "bruno.feld",
  },
  {
    displayName: "Cleo Marchetti",
    email: "cleo.marchetti@acme.example",
    id: "01900000-0000-7000-8000-000000000103",
    userName: "cleo.marchetti",
  },
  {
    displayName: "Devon Achebe",
    email: "devon.achebe@acme.example",
    id: "01900000-0000-7000-8000-000000000104",
    userName: "devon.achebe",
  },
  {
    displayName: "Elif Demir",
    email: "elif.demir@acme.example",
    id: "01900000-0000-7000-8000-000000000105",
    userName: "elif.demir",
  },
  {
    displayName: "Farah Nasser",
    email: "farah.nasser@acme.example",
    id: "01900000-0000-7000-8000-000000000106",
    userName: "farah.nasser",
  },
]

const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)

const personMatchesSearch = (person: DirectoryRealmAdminSearchFixture, search: string): boolean => {
  const needle = search.toLowerCase()
  return `${person.displayName} ${person.email} ${person.userName}`.toLowerCase().includes(needle)
}

/**
 * Fixture-backed adapter: three administrators plus five further searchable
 * users, honouring the same search contract the production adapter sends to
 * the server, so the demo exercises the same page state machine.
 */
export function directoryRealmAdministratorsDemoAdapterCreate(
  fixtureState: () => DemoFixtureState,
): DirectoryRealmAdministratorsAdapter {
  const administrators: RealmAdministrator[] = administratorFixtures.map((person, index) =>
    administratorEntryCreate(person, index),
  )

  const gate = <T>(op: string, value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "permission-denied") {
      const failure = resultErrorCodedCreate(op, "You do not manage this realm.", "realms.forbidden")
      failure.statusCode = 403
      return Promise.resolve(failure)
    }
    if (state === "error")
      return Promise.resolve(
        resultErrorCodedCreate(op, "The deterministic administrators fixture failed.", "realms.invalid"),
      )
    return Promise.resolve(value())
  }
  const empty = () => fixtureState() === "empty"

  return {
    administratorGrant: (userId) =>
      gate("directoryRealmAdministratorsDemoGrant", () => {
        const person = searchableFixtures.find((entry) => entry.id === userId)
        if (person === undefined)
          return resultErrorCodedCreate(
            "directoryRealmAdministratorsDemoGrant",
            "The realm user was not found.",
            "realms.not-found",
          )
        if (administrators.some((entry) => entry.userId === userId))
          return resultErrorCodedCreate(
            "directoryRealmAdministratorsDemoGrant",
            "The user is already a realm administrator.",
            "realms.administrator-exists",
          )
        const created: RealmAdministrator = {
          createdAt: now,
          createdBy: administrators[0]?.userId,
          realmId: demoRealm,
          user: { displayName: person.displayName, email: person.email, userName: person.userName },
          userId: person.id,
        }
        administrators.push(created)
        return resultCreate({ administrator: created })
      }),
    administratorList: () =>
      gate("directoryRealmAdministratorsDemoList", () =>
        resultCreate(empty() ? [] : [...administrators].sort((left, right) => left.createdAt - right.createdAt)),
      ),
    administratorRevoke: (userId) =>
      gate("directoryRealmAdministratorsDemoRevoke", () => {
        if (administrators.length === 1 && administrators[0]?.userId === userId)
          return resultErrorCodedCreate(
            "directoryRealmAdministratorsDemoRevoke",
            "The last realm administrator cannot be removed.",
            "realms.administrator-last",
          )
        const index = administrators.findIndex((entry) => entry.userId === userId)
        if (index < 0)
          return resultErrorCodedCreate(
            "directoryRealmAdministratorsDemoRevoke",
            "The realm administrator was not found.",
            "realms.not-found",
          )
        administrators.splice(index, 1)
        return resultCreate({ userId })
      }),
    realmUserSearch: (search) =>
      gate("directoryRealmAdministratorsDemoSearch", () => {
        const needle = search.trim()
        const rows = empty() ? [] : searchableFixtures.filter((person) => personMatchesSearch(person, needle))
        const entries: DirectoryEntry[] = rows.map((person, index) => ({
          memberships: [],
          user: {
            createdAt: now - index * day,
            displayName: person.displayName,
            email: person.email,
            emailVerified: true,
            id: person.id,
            state: "active",
            userName: person.userName,
            verificationState: "verified",
          },
        }))
        return resultCreate(entries)
      }),
  }
}

/** Deterministic resource id helper reuse for the demo grant path. */
export function directoryRealmAdministratorsDemoIdGenerate(): string {
  return demoResourceIdGenerate()
}
