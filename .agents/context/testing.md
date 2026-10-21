# Tests

## Layout

-   `test/0xx_fullchain*.test.ts` — end-to-end deal/task flows: classic, Boost, BoT, multi-orders, reopen.
-   `test/byContract/**` — per-facet suites, one directory per facet family.
-   `test/utils/` — shared helpers, described below.

## Helpers

-   `test/utils/hardhat-fixture-deployer.ts` — runs the real `deploy/0_deploy.ts` inside a `loadFixture` snapshot. Every suite starts from it, so tests exercise production deployment code rather than a test-only setup.
-   `test/utils/IexecWrapper.ts` — high-level actions.
-   `test/utils/fixture-helpers.ts` — account funding and ownership transfers, used by fork-mode runs.
-   `utils/poco-tools.ts` — `getIexecAccounts`, deal/task id derivation, result digest/hash builders, enclave and authorization message signing.
-   `utils/createOrders.ts` / `utils/odb-tools.ts` — order builders and EIP-712 signing.

## Timeouts and fork mode

Mocha timeout is 300s in `hardhat.config.ts` (40s in `.mocharc.json`, which only applies to direct mocha runs). Fork tests copy `deployments/arbitrumSepolia` in via a `test` task override in `hardhat.config.ts` and clean it up afterwards; drive them with `npm run test:arbitrumSepolia` (`ARBITRUM_SEPOLIA_FORK=true`).
