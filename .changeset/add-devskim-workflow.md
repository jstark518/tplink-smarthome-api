---
'@jstark/tplink-smarthome-api': patch
---

Add a DevSkim GitHub Actions workflow (`.github/workflows/devskim.yml`) that
runs static security analysis on pushes and pull requests to `main` and on a
weekly schedule, uploading results to the GitHub Security tab. This is a
CI/security tooling addition only; there is no runtime code change.
