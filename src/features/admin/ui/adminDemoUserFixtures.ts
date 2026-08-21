import type { User } from "../../users/public/userSchema.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)
const realmId = "01900000-0000-7000-8000-000000000001"

export const adminDemoUserFixtures: readonly User[] = [
  {
    createdAt: fixtureNow - 15_768_000_000,
    email: "alex.morgan@northwind.example",
    emailVerified: true,
    emailVerifiedAt: fixtureNow - 15_760_000_000,
    id: "01900000-0000-7000-8000-000000000021",
    profile: { displayName: "Alex Morgan", firstName: "Alex", lastName: "Morgan" },
    realmId,
    state: "active",
    updatedAt: fixtureNow - 86_400_000,
    userName: "alex.morgan",
    verificationState: "verified",
  },
  {
    createdAt: fixtureNow - 2_592_000_000,
    email: "priya.raman@northwind.example",
    emailVerified: false,
    id: "01900000-0000-7000-8000-000000000022",
    profile: { displayName: "Priya Raman", firstName: "Priya", lastName: "Raman" },
    realmId,
    state: "initial",
    updatedAt: fixtureNow - 172_800_000,
    userName: "priya.raman",
    verificationState: "unverified",
  },
  {
    createdAt: fixtureNow - 7_776_000_000,
    email: "sam.okafor@northwind.example",
    emailVerified: true,
    emailVerifiedAt: fixtureNow - 7_770_000_000,
    id: "01900000-0000-7000-8000-000000000023",
    profile: { displayName: "Sam Okafor", firstName: "Sam", lastName: "Okafor" },
    realmId,
    state: "locked",
    updatedAt: fixtureNow - 604_800_000,
    userName: "sam.okafor",
    verificationState: "verified",
  },
]
