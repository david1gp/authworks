/**
 * The bounded durations the guarded start form offers, in seconds. The server caps
 * impersonation at fifteen minutes, so no option may exceed 900 seconds.
 */
export const impersonationAdminDurationOptions = [300, 600, 900] as const satisfies readonly number[]
