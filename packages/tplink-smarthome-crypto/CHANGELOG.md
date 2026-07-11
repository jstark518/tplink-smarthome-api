# @jstark/tplink-smarthome-crypto

## 6.0.1

### Patch Changes

- e66cfb8: Restructure the repository into an npm-workspaces monorepo.

  `@jstark/tplink-smarthome-crypto` is now vendored and published from this repo (a
  maintained, dependency-free fork of `tplink-smarthome-crypto`), and
  `@jstark/tplink-smarthome-api` depends on it directly instead of the upstream
  package. No public API changes.
