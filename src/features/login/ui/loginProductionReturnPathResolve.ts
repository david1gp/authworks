import { loginReturnPathSelect } from "../model/loginReturnPathSelect.js"

export async function loginProductionReturnPathResolve(options: {
  readonly returnTo: string | null
  readonly destinationResolve: () => Promise<string | undefined>
  readonly timeoutMs?: number
}): Promise<string> {
  if (options.returnTo !== null && options.returnTo.length > 0)
    return loginReturnPathSelect(options.returnTo, "/account")
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), options.timeoutMs ?? 1_500))
  return (await Promise.race([options.destinationResolve(), timeout])) ?? "/account"
}
