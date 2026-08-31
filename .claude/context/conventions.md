# Conventions

## Every file

-   Solidity and TypeScript files open with the header pair:

    ```
    // SPDX-FileCopyrightText: <years> IEXEC BLOCKCHAIN TECH <contact@iex.ec>
    // SPDX-License-Identifier: Apache-2.0
    ```

-   `npm run format` (Prettier, with `prettier-plugin-solidity` and `prettier-plugin-organize-import`) is the formatter. CI runs `format:check`.
-   Solidity imports are named (`import {Foo} from "./Foo.sol";`), not bare. The Solidity plugin does not sort them, so keep the existing grouping by hand.

## Published surface

`package.json#files` publishes `abis/`, `contracts/`, `deployments/` and `artifacts/contracts`. Consumers are the iExec SDK and the subgraph, so **any ABI, artifact path or artifact name change is a public API change**. A breaking one needs a `feat!:` or `refactor!:` PR title and a note for those two consumers.

Event signatures are part of that surface twice over: changing one moves its `topic0` and silently breaks the subgraph.

## Storage

Every facet shares one struct behind `contracts/libs/PocoStorageLib.sol`. Never reorder or remove an existing variable, only append. `npm run check-storage-layout` is the gate.

## Generated, never hand-edit

`abis/**`, `typechain/`, `docs/solidity/index.md`, `docs/uml/*.svg`. Edit the NatSpec or the generator config, then regenerate.

## Hand-maintained lists

Two lists are not generated and must be edited when a facet is added, removed or renamed:

-   `utils/proxy-tools.ts#getAllLocalFacetFunctions`
-   the facet groups in `scripts/tools/sol-to-uml.mjs`

## Git

-   Trunk-based, squash merges only. The PR title becomes the commit message, so it must follow Conventional Commits.
-   Historical records are not rewritten: `CHANGELOG.md`, the upgrade reports under `scripts/upgrades/*.md` and the `deployments/` artifacts describe what was actually released and deployed, including names that have since changed.
