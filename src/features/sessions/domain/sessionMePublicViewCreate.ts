import type { SessionRow } from "../persistence/sessionTable.js"
import type { SessionMe } from "../public/sessionMeSchema.js"

export function sessionMePublicViewCreate(row: SessionRow, current = false): SessionMe {
  return {
    assurance: row.assurance as SessionMe["assurance"],
    authenticationMethod: row.authenticationMethod as SessionMe["authenticationMethod"],
    createdAt: row.createdAt,
    current,
    device: {
      ...(row.deviceDescription === null ? {} : { description: row.deviceDescription }),
      ...(row.ipAddress === null ? {} : { ipAddress: row.ipAddress }),
      ...(row.userAgent === null ? {} : { userAgent: row.userAgent }),
    },
    expiresAt: row.expiresAt,
    id: row.id,
    lastUsedAt: row.lastUsedAt,
    ...(row.mfaMethod === null ? {} : { mfaMethod: row.mfaMethod as SessionMe["mfaMethod"] }),
    revokedAt: row.revokedAt,
  }
}
