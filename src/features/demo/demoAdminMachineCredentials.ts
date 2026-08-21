import type { MachineCredential } from "../machineUsers/public/machineCredentialSchema.js"
import { demoRealmId } from "./demoRealmId.js"

const billingSyncId = "01900000-0000-7000-8000-000000000071"
const reportExporterId = "01900000-0000-7000-8000-000000000072"

/**
 * Credential metadata only. A stored secret value is never part of this fixture, mirroring
 * the write-only production contract where a secret exists solely at the moment it is issued.
 */
export const demoAdminMachineCredentials: MachineCredential[] = [
  {
    createdAt: 1_754_054_400_000,
    id: "01900000-0000-7000-8000-000000000081",
    kind: "client_secret",
    machineUserId: billingSyncId,
    name: "Client secret",
    realmId: demoRealmId,
    scopes: ["billing.read", "billing.write"],
  },
  {
    createdAt: 1_754_140_800_000,
    expiresAt: 1_788_480_000_000,
    id: "01900000-0000-7000-8000-000000000082",
    kind: "personal_access_token",
    machineUserId: billingSyncId,
    name: "Deployment pipeline token",
    realmId: demoRealmId,
    scopes: ["billing.read"],
  },
  {
    // Already past the fixture "now", so the expiry state is visible without waiting.
    createdAt: 1_753_968_000_000,
    expiresAt: 1_754_572_800_000,
    id: "01900000-0000-7000-8000-000000000083",
    kind: "api_key",
    machineUserId: billingSyncId,
    name: "Expired reporting key",
    realmId: demoRealmId,
    scopes: ["billing.read"],
  },
  {
    createdAt: 1_754_227_200_000,
    id: "01900000-0000-7000-8000-000000000084",
    kind: "api_key",
    machineUserId: billingSyncId,
    name: "Revoked integration key",
    realmId: demoRealmId,
    revokedAt: 1_755_436_800_000,
    scopes: ["billing.read"],
  },
  {
    createdAt: 1_754_486_400_000,
    id: "01900000-0000-7000-8000-000000000085",
    kind: "client_secret",
    machineUserId: reportExporterId,
    name: "Client secret",
    realmId: demoRealmId,
    scopes: ["reports.read"],
  },
] satisfies MachineCredential[]
