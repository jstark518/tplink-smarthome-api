# @jstark/tplink-smarthome-crypto

## 6.0.2

### Patch Changes

- 03ab24e: Adopt `typescript` 5.9.x and `@types/node` ^22 across the workspace, and remove
  dead `@ts-expect-error` directives and redundant type assertions that TS 5.9
  proves unnecessary.

## 6.0.1

### Patch Changes

- e66cfb8: Restructure the repository into an npm-workspaces monorepo.

  `@jstark/tplink-smarthome-crypto` is now vendored and published from this repo (a
  maintained, dependency-free fork of `tplink-smarthome-crypto`), and
  `@jstark/tplink-smarthome-api` depends on it directly instead of the upstream
  package. No public API changes.
