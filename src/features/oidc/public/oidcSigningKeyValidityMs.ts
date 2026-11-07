/**
 * How long a signing key stays scheduled before rotation, in milliseconds.
 * The value is informational rotation scheduling: retired keys still verify
 * previously issued tokens through the JWKS grace window. Single source for
 * every `expiresAt` derivation (storage backfill documents the same duration
 * inline because DDL cannot import it).
 */
export const oidcSigningKeyValidityMs = 365 * 24 * 60 * 60 * 1_000
