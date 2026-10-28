import * as v from "valibot"

/** Member/guest simulations must not inherit the demo's default IAM administrator. */
export function adminActivityDemoAccessPermits(search: string): boolean {
  return !v.safeParse(v.picklist(["member", "guest"]), new URLSearchParams(search).get("as")).success
}
