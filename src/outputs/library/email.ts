// Mail transport factories (SMTP delivery, IMAP receive) depend on node-only
// mail libraries, so they stay server-output only. Import them from the
// feature server surface (see src/outputs/server.ts); this barrel publishes
// only the environment-neutral generator client and render contracts.
export { emailGeneratorApiClientCreate } from "../../features/email/client/emailGeneratorApiClientCreate.js"
export * from "../../features/email/public/index.js"
