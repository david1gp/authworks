# Codeline production organization ID handoff

`authworks oidc codeline-production-organization-id-get` is a zero-argument,
read-only production command intended only for the Contentoren `prodctl` bridge.
It uses the protected Authworks system secret, the fixed
`https://authworks.contentoren.de` origin, and no caller-selected profile,
server, realm, organization, or output path.

The command resolves exactly one active realm whose primary domain is
`authworks.contentoren.de` and exactly one active organization whose exact name
is `Contentoren`. If an `ssotest` human exists, it also requires the existing
safe fixture semantics: no same-name machine identity, one active human in the
production realm, and one non-elevated `member` membership in that exact
organization. An absent `ssotest` human does not block the organization-ID
handoff. No user, organization, membership, or other Authworks state is changed.

Success emits exactly one newline-terminated machine envelope and nothing else:

```json
{"organizationId":"<uuid-v7>"}
```

The envelope has no kind, version, metadata, or additional identifiers. It is
one-time transport output: operators must not print, log, copy, or persist it
outside the ignored Codeline environment file. Failures write no stdout and
emit only one allowlisted JSON error code on stderr. API bodies, URLs, status
details, IDs, account data, tokens, and exception text are never included.

Production execution and deployment are intentionally performed only through
the separately reviewed Contentoren `prodctl` workflow.
