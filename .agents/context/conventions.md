# Conventions

## Public API surface

`abis/`, `contracts/`, `deployments/` and `artifacts/contracts` ship in the npm package (`package.json#files`), so **ABI and deployment-artifact changes are public API changes** — consumers are the iExec SDK and the subgraph. A breaking one needs a `feat!:` / `refactor!:` PR title.

## Headers

Every Solidity and TypeScript file opens with the `SPDX-FileCopyrightText` / `SPDX-License-Identifier: Apache-2.0` header pair.

## Git

Trunk-based, squash merges only. The PR title becomes the commit message and must follow Conventional Commits (`conventional-commits.yml` enforces it). Releases are cut by Release Please; prereleases by `npm run prerelease`, which requires `package.json` and the git tag to agree.
