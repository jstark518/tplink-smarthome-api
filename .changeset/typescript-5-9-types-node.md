---
---

Adopt `typescript` 5.9.x and `@types/node` ^22, and remove dead
`@ts-expect-error` directives and redundant type assertions that TS 5.9 proves
unnecessary. Type-level only — the compiled output is unchanged, so no release.
