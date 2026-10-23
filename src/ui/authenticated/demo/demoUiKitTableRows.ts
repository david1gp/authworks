import type { DemoUiKitTableRow } from "./demoUiKitQuerySchema.js"

const demoUiKitDayMs = 86_400_000

const demoUiKitNow = Date.UTC(2026, 9, 23, 12, 0, 0)

/** Fixture user rows for the UI-kit data-table showcase: mixed roles, states, and sign-in ages. */
export const demoUiKitTableRows: readonly DemoUiKitTableRow[] = [
  {
    id: "01900000-0000-7000-8000-0000000000a1",
    name: "Alex Morgan",
    email: "alex.morgan@northwind.example",
    role: "owner",
    state: "active",
    lastSignInAt: demoUiKitNow - 5 * 60_000,
    createdAt: demoUiKitNow - 320 * demoUiKitDayMs,
  },
  {
    id: "01900000-0000-7000-8000-0000000000a2",
    name: "Priya Raman",
    email: "priya.raman@northwind.example",
    role: "admin",
    state: "active",
    lastSignInAt: demoUiKitNow - 3 * 3_600_000,
    createdAt: demoUiKitNow - 210 * demoUiKitDayMs,
  },
  {
    id: "01900000-0000-7000-8000-0000000000a3",
    name: "Sam Okafor",
    email: "sam.okafor@northwind.example",
    role: "member",
    state: "active",
    lastSignInAt: demoUiKitNow - 2 * demoUiKitDayMs,
    createdAt: demoUiKitNow - 150 * demoUiKitDayMs,
  },
  {
    id: "01900000-0000-7000-8000-0000000000a4",
    name: "Noor Haddad",
    email: "noor.haddad@northwind.example",
    role: "member",
    state: "suspended",
    lastSignInAt: demoUiKitNow - 9 * demoUiKitDayMs,
    createdAt: demoUiKitNow - 96 * demoUiKitDayMs,
  },
  {
    id: "01900000-0000-7000-8000-0000000000a5",
    name: "Jonas Weber",
    email: "jonas.weber@northwind.example",
    role: "guest",
    state: "active",
    lastSignInAt: demoUiKitNow - 41 * demoUiKitDayMs,
    createdAt: demoUiKitNow - 45 * demoUiKitDayMs,
  },
]
