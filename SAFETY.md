# What goes in this log — and what never does

This repository is the only public record of HOODOGE development. Everything else is private.

## Allowed
- Which product changed and in what area (e.g. "Sherwood Outlaw — Card Combat").
- What a player can now see or do, in one or two plain sentences.
- Launch dates and links to the live sites on hoodoge.com.

## Never
- Source code, file names, repository or folder names, infrastructure or vendor details.
- Keys, tokens, secrets, cookies, session or client identifiers, wallet or contract addresses, transaction hashes.
- Anti-cheat or validation specifics (how scores are verified, timing limits, rate limits).
- Exact economy figures (reward rates, prices, caps) — describe the feature, not the numbers.
- Anything about users: names, scores, wallets, counts.

## How it is enforced
`tools/publish.mjs` refuses to publish if any entry matches an address/hash pattern, a credential word, a source-file name, an infrastructure word, a large number, or a link outside hoodoge.com. Entries are written by hand at deploy time, not copied from commit messages.
