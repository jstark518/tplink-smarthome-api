---
'@jstark/tplink-smarthome-api': patch
'@jstark/tplink-smarthome-crypto': patch
---

Adopt `typescript` 5.9.x and `@types/node` ^22 across the workspace, and remove
dead `@ts-expect-error` directives and redundant type assertions that TS 5.9
proves unnecessary.
