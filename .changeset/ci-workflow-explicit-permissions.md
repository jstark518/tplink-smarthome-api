---
'@jstark/tplink-smarthome-api': patch
---

Add an explicit top-level `permissions` block to the CI workflow
(`contents: read`, `actions: read`) so all jobs default to
least-privilege `GITHUB_TOKEN` scopes. This addresses a GitHub code
scanning alert about workflows without explicit permissions and is a
CI/security hardening change only; there is no runtime code change.
