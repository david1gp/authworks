import type { Session } from "../public/sessionSchema.js"
import type { SessionRow } from "../persistence/sessionTable.js"

export function sessionPublicViewCreate(row: SessionRow, current = false): Session {
  return {
    assurance: row.assurance as Session["assurance"],
    authenticationMethod: row.authenticationMethod as Session["authenticationMethod"],
    createdAt: row.createdAt,
    current,
    device: {
      ...(row.deviceDescription === null ? {} : { description: row.deviceDescription }),
      ...(row.deviceFingerprint === null ? {} : { fingerprint: row.deviceFingerprint }),
      ...(row.ipAddress === null ? {} : { ipAddress: row.ipAddress }),
      ...(row.userAgent === null ? {} : { userAgent: row.userAgent }),
    },
    expiresAt: row.expiresAt,
    id: row.id,
    instanceId: row.instanceId,
    lastUsedAt: row.lastUsedAt,
    ...(row.mfaMethod === null ? {} : { mfaMethod: row.mfaMethod as Session["mfaMethod"] }),
    revokedAt: row.revokedAt,
    userId: row.userId,
  }
}
