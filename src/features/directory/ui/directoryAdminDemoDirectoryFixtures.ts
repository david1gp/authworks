import { demoRealmId } from "../../demo/demoRealmId.js"
import type { MachineUser } from "../../machineUsers/public/machineUserSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"

const demoOrganizationId = "01900000-0000-7000-8000-000000000011"
const demoSecondOrganizationId = "01900000-0000-7000-8000-000000000012"
const day = 86_400_000
const now = 1_755_782_400_000

type DirectoryPersonFixture = {
  readonly displayName?: string
  readonly email: string
  readonly emailVerified: boolean
  readonly firstName?: string
  readonly id: string
  readonly lastName?: string
  readonly lastSignInAt?: number
  readonly phoneNumber?: string
  readonly organizationRoles: readonly ("owner" | "admin" | "member" | "guest")[]
  readonly otherMemberships?: readonly {
    readonly organizationId: string
    readonly organizationName: string
    readonly roles: readonly ("owner" | "admin" | "member" | "guest")[]
  }[]
  readonly state: "initial" | "active" | "inactive" | "locked" | "suspended"
  readonly userName: string
  readonly verificationState: "unverified" | "verified"
}

const personFixtures: readonly DirectoryPersonFixture[] = [
  {
    displayName: "Ada Osei",
    email: "ada.osei@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100001",
    firstName: "Ada",
    id: "01900000-0000-7000-8000-000000000101",
    lastName: "Osei",
    lastSignInAt: now - 5 * 60_000,
    organizationRoles: ["owner"],
    state: "active",
    userName: "ada.osei",
    verificationState: "verified",
  },
  {
    displayName: "Bruno Feld",
    email: "bruno.feld@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100002",
    firstName: "Bruno",
    id: "01900000-0000-7000-8000-000000000102",
    lastName: "Feld",
    lastSignInAt: now - 2 * 3_600_000,
    organizationRoles: ["admin"],
    otherMemberships: [
      { organizationId: demoSecondOrganizationId, organizationName: "Globex Corporation", roles: ["member"] },
    ],
    state: "active",
    userName: "bruno.feld",
    verificationState: "verified",
  },
  {
    displayName: "Cleo Marchetti",
    email: "cleo.marchetti@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100003",
    firstName: "Cleo",
    id: "01900000-0000-7000-8000-000000000103",
    lastName: "Marchetti",
    lastSignInAt: now - 1 * day,
    organizationRoles: ["member"],
    state: "active",
    userName: "cleo.marchetti",
    verificationState: "verified",
  },
  {
    displayName: "Devon Achebe",
    email: "devon.achebe@acme.example",
    emailVerified: false,
    phoneNumber: "+15550100004",
    firstName: "Devon",
    id: "01900000-0000-7000-8000-000000000104",
    lastName: "Achebe",
    lastSignInAt: now - 3 * day,
    organizationRoles: ["member"],
    state: "active",
    userName: "devon.achebe",
    verificationState: "unverified",
  },
  {
    displayName: "Elif Demir",
    email: "elif.demir@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100005",
    firstName: "Elif",
    id: "01900000-0000-7000-8000-000000000105",
    lastName: "Demir",
    lastSignInAt: now - 9 * day,
    organizationRoles: ["guest"],
    state: "active",
    userName: "elif.demir",
    verificationState: "verified",
  },
  {
    displayName: "Farah Nasser",
    email: "farah.nasser@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100006",
    firstName: "Farah",
    id: "01900000-0000-7000-8000-000000000106",
    lastName: "Nasser",
    organizationRoles: ["member"],
    state: "initial",
    userName: "farah.nasser",
    verificationState: "unverified",
  },
  {
    displayName: "Gus Halvorsen",
    email: "gus.halvorsen@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100007",
    firstName: "Gus",
    id: "01900000-0000-7000-8000-000000000107",
    lastName: "Halvorsen",
    lastSignInAt: now - 21 * day,
    organizationRoles: ["member"],
    state: "inactive",
    userName: "gus.halvorsen",
    verificationState: "verified",
  },
  {
    displayName: "Hana Sato",
    email: "hana.sato@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100008",
    firstName: "Hana",
    id: "01900000-0000-7000-8000-000000000108",
    lastName: "Sato",
    lastSignInAt: now - 35 * day,
    organizationRoles: ["admin"],
    state: "locked",
    userName: "hana.sato",
    verificationState: "verified",
  },
  {
    displayName: "Ivan Petrov",
    email: "ivan.petrov@acme.example",
    emailVerified: false,
    phoneNumber: "+15550100009",
    firstName: "Ivan",
    id: "01900000-0000-7000-8000-000000000109",
    lastName: "Petrov",
    lastSignInAt: now - 60 * day,
    organizationRoles: ["member"],
    state: "suspended",
    userName: "ivan.petrov",
    verificationState: "unverified",
  },
  {
    displayName: "Juno Reyes",
    email: "juno.reyes@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100010",
    firstName: "Juno",
    id: "01900000-0000-7000-8000-000000000110",
    lastName: "Reyes",
    organizationRoles: ["owner"],
    otherMemberships: [
      { organizationId: demoSecondOrganizationId, organizationName: "Globex Corporation", roles: ["owner"] },
    ],
    state: "active",
    userName: "juno.reyes",
    verificationState: "verified",
  },
  {
    displayName: "Kai Lindqvist",
    email: "kai.lindqvist@acme.example",
    emailVerified: true,
    phoneNumber: "+15550100011",
    firstName: "Kai",
    id: "01900000-0000-7000-8000-000000000111",
    lastName: "Lindqvist",
    lastSignInAt: now - 90 * day,
    organizationRoles: ["guest"],
    state: "active",
    userName: "kai.lindqvist",
    verificationState: "verified",
  },
  {
    displayName: "Lena Fischer",
    email: "lena.fischer@globex.example",
    emailVerified: true,
    firstName: "Lena",
    id: "01900000-0000-7000-8000-000000000112",
    lastName: "Fischer",
    lastSignInAt: now - 4 * 3_600_000,
    organizationRoles: ["member"],
    otherMemberships: [
      { organizationId: demoSecondOrganizationId, organizationName: "Globex Corporation", roles: ["admin"] },
    ],
    state: "active",
    userName: "lena.fischer",
    verificationState: "verified",
  },
  {
    displayName: "Mara Ibarra",
    email: "mara.ibarra@acme.example",
    emailVerified: false,
    firstName: "Mara",
    id: "01900000-0000-7000-8000-000000000113",
    lastName: "Ibarra",
    lastSignInAt: now - 12 * 3_600_000,
    organizationRoles: ["member"],
    state: "initial",
    userName: "mara.ibarra",
    verificationState: "unverified",
  },
]

const createdAtFor = (index: number) => now - (180 - index * 7) * day

export type DirectoryAdminDemoTeamFixture = {
  readonly id: string
  readonly leaderUserId: string
  readonly memberUserIds: readonly string[]
  readonly name: string
  readonly slug: string
}

const teamFixtures: readonly DirectoryAdminDemoTeamFixture[] = [
  {
    id: "01900000-0000-7000-8000-000000000161",
    leaderUserId: "01900000-0000-7000-8000-000000000103",
    memberUserIds: [
      "01900000-0000-7000-8000-000000000103",
      "01900000-0000-7000-8000-000000000104",
      "01900000-0000-7000-8000-000000000106",
      "01900000-0000-7000-8000-000000000107",
    ],
    name: "Platform",
    slug: "platform",
  },
  {
    id: "01900000-0000-7000-8000-000000000162",
    leaderUserId: "01900000-0000-7000-8000-000000000113",
    memberUserIds: [
      "01900000-0000-7000-8000-000000000113",
      "01900000-0000-7000-8000-000000000109",
      "01900000-0000-7000-8000-000000000111",
    ],
    name: "Growth",
    slug: "growth",
  },
  {
    id: "01900000-0000-7000-8000-000000000163",
    leaderUserId: "01900000-0000-7000-8000-000000000105",
    memberUserIds: ["01900000-0000-7000-8000-000000000105", "01900000-0000-7000-8000-000000000112"],
    name: "Design",
    slug: "design",
  },
]

/** The demo organization teams: leaders, members, and everyone else unassigned. */
export const directoryAdminDemoTeams: readonly DirectoryAdminDemoTeamFixture[] = teamFixtures

const demoTeamOfGet = (userId: string): { id: string; name: string; slug: string } | null => {
  const team = teamFixtures.find((candidate) => candidate.memberUserIds.includes(userId))
  return team === undefined ? null : { id: team.id, name: team.name, slug: team.slug }
}

/** Deterministic people fixtures for the demo users page; states stay parseable as `DirectoryEntry`. */
export const directoryAdminDemoPeople: DirectoryEntry[] = personFixtures.map((person, index) => {
  const createdAt = createdAtFor(index)
  return {
    team: demoTeamOfGet(person.id),
    memberships: [
      {
        createdAt,
        membershipId: `01900000-0000-7000-8000-100000000${String(index + 1).padStart(3, "0")}`,
        organizationId: demoOrganizationId,
        organizationName: "Acme Corporation",
        roles: [...person.organizationRoles],
      },
      ...(person.otherMemberships ?? []).map((other, otherIndex) => ({
        createdAt,
        membershipId: `01900000-0000-7000-8000-200000000${String(index + 1).padStart(3, "0")}${otherIndex}`,
        organizationId: other.organizationId,
        organizationName: other.organizationName,
        roles: [...other.roles],
      })),
    ],
    user: {
      ...(person.phoneNumber === undefined ? {} : { phoneNumber: person.phoneNumber }),
      createdAt,
      ...(person.displayName === undefined ? {} : { displayName: person.displayName }),
      email: person.email,
      emailVerified: person.emailVerified,
      id: person.id,
      ...(person.lastSignInAt === undefined ? {} : { lastSignInAt: person.lastSignInAt }),
      state: person.state,
      userName: person.userName,
      verificationState: person.verificationState,
    },
  }
})

export const directoryAdminDemoSummary: DirectoryOrganizationUserSummary = {
  roles: { admin: 2, guest: 2, member: 7, owner: 2 },
  total: 13,
}

export const directoryAdminDemoServiceAccounts: MachineUser[] = [
  {
    createdAt: now - 120 * day,
    displayName: "Billing Sync Service",
    id: "01900000-0000-7000-8000-000000000141",
    realmId: demoRealmId,
    scopes: ["billing.read", "billing.write"],
    status: "active",
    updatedAt: now - 1 * day,
    userName: "billing-sync",
  },
  {
    createdAt: now - 200 * day,
    displayName: "Legacy Provisioning Agent",
    id: "01900000-0000-7000-8000-000000000142",
    realmId: demoRealmId,
    scopes: ["users.write"],
    status: "inactive",
    updatedAt: now - 30 * day,
    userName: "legacy-provisioning",
  },
]

export const directoryAdminDemoInvitations: OrganizationInvitation[] = [
  {
    acceptedAt: null,
    createdAt: now - 2 * day,
    email: "rowan@example.com",
    expiresAt: now + 5 * day,
    id: "01900000-0000-7000-8000-000000000151",
    invitedBy: {
      displayName: "Cleo Marchetti",
      email: "cleo.marchetti@acme.example",
      userId: "01900000-0000-7000-8000-000000000103",
    },
    organizationId: demoOrganizationId,
    realmId: demoRealmId,
    roles: ["member"],
    status: "pending",
    team: { name: "Platform", slug: "platform" },
    teamId: "01900000-0000-7000-8000-000000000161",
    updatedAt: now - 2 * day,
  },
  {
    acceptedAt: null,
    createdAt: now - 9 * day,
    email: "sam@example.com",
    expiresAt: now - 2 * day,
    id: "01900000-0000-7000-8000-000000000152",
    invitedBy: {
      displayName: "Ada Osei",
      email: "ada.osei@acme.example",
      userId: "01900000-0000-7000-8000-000000000101",
    },
    organizationId: demoOrganizationId,
    realmId: demoRealmId,
    roles: ["admin", "member"],
    status: "expired",
    team: null,
    teamId: null,
    updatedAt: now - 2 * day,
  },
]
