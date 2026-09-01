# Architecture

## Diamond proxy

`contracts/Diamond.sol` plus the standard `DiamondCutFacet` / `DiamondLoupeFacet` / `OwnershipFacet` / `DiamondInit`, pulled in through `hardhat-dependency-compiler` from `@mudgen/diamond-1`.

-   Protocol logic: `contracts/facets/*Facet.sol`
-   External API declarations: `contracts/interfaces/`
-   `contracts/IexecInterfaceToken.sol` aggregates them into the single interface downstream tools compile against
-   Shared helpers: `contracts/abstract/` for inherited bases (`FacetBase`) and `contracts/libs/` for stateless helper libraries (`CommonLib`, `EscrowLib`, `PocoStorageLib`, …)
-   Storage lives in one struct accessed through `contracts/libs/PocoStorageLib.sol`, shared by every facet: **never reorder or remove an existing variable, only append**. `npm run check-storage-layout` is the CI gate.
-   Adding or removing a facet means editing two hand-maintained lists: `utils/proxy-tools.ts#getAllLocalFacetFunctions` (selector-to-name map used by upgrades) and the facet groups in `scripts/tools/sol-to-uml.mjs`.

Three solc versions: `0.8.21` with `viaIR` for PoCo contracts, `0.6.12` for the `@amxx/factory` dependency, `0.4.24` for RLC. A `docgen` task override in `hardhat.config.ts` temporarily hides 0.4 build-info files because docgen cannot parse them.

## Deployment

`deploy/0_deploy.ts` is the single source of truth.

Boost facets (`IexecPocoBoostFacet`, `IexecPocoBoostAccessorsFacet`) are deliberately **not** deployed on Arbitrum mainnet/Sepolia — see the `isArbitrumMainnetOrSepolia` branch in `deploy/0_deploy.ts`.

Changing `SALT` changes every derived address, which breaks integrations that rely on deterministic addresses.

## Chain config

-   `token: null` makes the deployment deploy a fresh RLC mock; a real address makes it reuse that token.
-   Registries are looked up before deployment, so several marketplaces on one chain share them.

## Orders

Off-chain EIP-712 orders (app / dataset / workerpool / request) are matched on-chain by `IexecPoco1Facet` (`matchOrders` plus sponsored variants) or, in the Boost flow, by `IexecPocoBoostFacet`. Structs and hashing live in the linked library `contracts/libs/IexecLibOrders_v5.sol`. The TypeScript side is `utils/createOrders.ts` (builders) and `utils/odb-tools.ts` (signing).

## Task lifecycle

`IexecPoco2Facet` implements initialize → contribute → reveal → finalize, with reopen and claim paths. Escrow and staking are in `IexecEscrowTokenFacet`: deposited RLC is tracked as an internal, non-transferable ERC-20-like balance. Enums and helpers mirroring on-chain state are in `utils/poco-tools.ts` (`TaskStatusEnum`, `ContributionStatusEnum`, `PocoMode`, `getDealId`, `getTaskId`, enclave/authorization signing, `getIexecAccounts`).

## Registries

`contracts/registries/` holds ERC-721 registries for apps, datasets and workerpools. Entries are minimal proxies (`RegistryEntry`, `InitializableUpgradeabilityProxy`) at create2-predictable addresses.
