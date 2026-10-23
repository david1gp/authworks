export function e2eCheckpointActivePathGet(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  const path = environment.AUTHWORKS_E2E_CHECKPOINT_PATH
  return path === undefined || path === "" ? undefined : path
}
