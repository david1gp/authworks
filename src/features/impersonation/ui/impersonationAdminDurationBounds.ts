/**
 * The server-enforced impersonation duration bounds, restated so the guarded form can reject
 * an out-of-range value before any request is sent. The server remains the authority.
 */
export const impersonationAdminDurationBounds = { maximumSeconds: 900, minimumSeconds: 1 } as const
