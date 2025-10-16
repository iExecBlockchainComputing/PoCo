# PoCo Smart Contracts Upgrade Guide

This document explains the recommended steps for creating and applying
a safe, traceable, and reproducible upgrade to the PoCo Diamond proxy.

## Upgrade Steps

0. **Ensure all tests pass**:<br>
    Run the full test suite to make sure everything is working before starting an upgrade.

1. **Create a new upgrade script**:<br>
    Name the script using the version and upgrade name format: `vX.Y.Z-upgrade-name.ts`.

2. **Create a corresponding Markdown report**:<br>
    Copy the template file `v0.0.0-template.md` and rename it to match the script: `vX.Y.Z-upgrade-name.md`.

3. **Update GitHub Actions**:<br>
    Modify `upgrade-facets.yml` workflow to call the new upgrade script.

4. **Upgrade on Testnet**:
   - ⚠️ Always upgrade on the testnet first.
   - Trigger the upgrade workflow on GitHub and choose the testnet network.
   - Start with a **dry run** to simulate the upgrade.
   - Once verified, apply the upgrade on the live testnet.

5. **Upgrade on Mainnet**:
   - Trigger the upgrade workflow on GitHub and choose the mainnet network.
   - Perform a dry run first.
   - Apply the upgrade on the mainnet.
   - Merge the artifacts PR after successful execution.

6. **Update upgrade report**:<br>
    Fill in all required information in `vX.Y.Z-upgrade-name.ts` (tx hashes, logs, ...).

7. **Create a release**
   - Use **Release Please** to tag the upgrade version and create the release on GitHub.


Following these steps ensures upgrades are **safe, traceable, and reproducible**.
