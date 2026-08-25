# Production signing-key ensure

Run the fixed, zero-argument Authworks command only through the Contentoren
`prodctl authworks-signing-key-ensure` bridge:

```text
authworks oidc production-signing-key-ensure
```

The command securely reads the owner-only
`/home/authworks/.config/authworks/authworks.env`, resolves exactly one active
realm whose primary domain is `authworks.contentoren.de`, and lists all of that
realm's signing keys through the management API. It emits exactly `created` or
`reused` on stdout.

One valid active RS256 key is reused. With no active key, the command invokes
the atomic `ensure-active` API operation, which creates one key without retiring
any key. The resulting active key is listed again and its realm, lifecycle,
algorithm, key ID, and RSA public JWK are verified.

The workflow refuses ambiguous realms, repeated pagination, malformed API
responses, malformed active keys, multiple active keys, rejected mutation, or
post-mutation mismatch. It never chooses between active keys and never rotates,
retires, or replaces an active key. Failures use only the closed
`oidc.production-signing-key-ensure.*` JSON error codes and never include IDs,
keys, secrets, response bodies, URLs, or exception text.
