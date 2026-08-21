import type { MachineUser } from "../machineUsers/public/machineUserSchema.js"
import { demoRealmId } from "./demoRealmId.js"

export const demoAdminMachineUsers: MachineUser[] = [
  {
    createdAt: 1_754_054_400_000,
    displayName: "Billing Sync Service",
    id: "01900000-0000-7000-8000-000000000071",
    realmId: demoRealmId,
    scopes: ["billing.read", "billing.write"],
    status: "active",
    updatedAt: 1_755_782_400_000,
    userName: "billing-sync",
  },
  {
    createdAt: 1_754_486_400_000,
    displayName: "Nightly Report Exporter",
    id: "01900000-0000-7000-8000-000000000072",
    realmId: demoRealmId,
    scopes: ["reports.read"],
    status: "active",
    updatedAt: 1_755_609_600_000,
    userName: "report-exporter",
  },
  {
    createdAt: 1_753_968_000_000,
    displayName: "Legacy Provisioning Agent",
    id: "01900000-0000-7000-8000-000000000073",
    realmId: demoRealmId,
    scopes: ["users.write"],
    status: "inactive",
    updatedAt: 1_755_523_200_000,
    userName: "legacy-provisioning",
  },
] satisfies MachineUser[]
