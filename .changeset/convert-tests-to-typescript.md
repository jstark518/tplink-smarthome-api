---
'@jstark/tplink-smarthome-api': patch
---

Convert the remaining JavaScript (mocha test specs + examples) to TypeScript so
they are type-checked under `tsc` alongside the already-typed `src/`. Lock this
in by reducing `.mocharc` `extension` to `["ts"]` and setting `allowJs: false`.
