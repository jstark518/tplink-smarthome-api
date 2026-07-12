---
'@jstark/tplink-smarthome-api': patch
---

Mask `cloudUsername` in test setup log output (`test/setup/config.ts`),
matching the existing password-redaction pattern, instead of printing it in
clear text. This addresses a code scanning alert about clear-text logging of
sensitive information. This only affects test-only log output; there is no
change to runtime behavior.
