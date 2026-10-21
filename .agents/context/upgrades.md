# Facet upgrades

Full human-facing procedure: `scripts/upgrades/README.md`.

## Traps

-   `getAllLocalFacetFunctions` in the same file is hand-maintained: a facet added or deleted without editing it leaves selectors unresolved during the upgrade.
-   `npm run check-storage-layout` compares layouts found in `artifacts/build-info`; storage stays append-only across versions.
-   After a mainnet upgrade, refresh the facet list on the block explorer ("Is this a proxy?") so the proxy reads correctly.
