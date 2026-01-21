# PoCo Smart Contracts Upgrade Guide

This document explains the recommended steps for creating and applying
a safe, traceable, and reproducible upgrade to the PoCo Diamond proxy.

## Upgrade Steps

0. **Ensure all tests pass**:<br>
   Run the full test suite to make sure everything is working before starting an upgrade.

1. **Create a new upgrade script**:<br>
   Name the script using the version and upgrade name format `vX.Y.Z.ts` and
   implement the upgrade logic.

2. **Create a corresponding Markdown report**:<br>
   Copy the template file `v0.0.0-template.md` and rename it to match the script file name.
   The name should be of the form `vX.Y.Z-upgrade-name.md`.

3. **Test dry-runs locally**:<br>
   Use the script [./dry-run.sh](./dry-run.sh) and check the logs and deployment files diff.

4. **Check the owner's balance:**<br>
   Make sure the owner wallet has enough ETH for the hole deployment.

5. **Update GitHub Actions**:<br>
   Modify `upgrade-facets.yml` workflow to call the new upgrade script.<br>
   Note: to run the upgrade script manually (for testing), use:

    ```
    npx hardhat run scripts/upgrades/vX.Y.Z-upgrade-name.ts --network <network>
    ```

6. **Upgrade on Testnet**:

    - ⚠️ Always upgrade on the testnet first.
    - Trigger the upgrade workflow on GitHub and choose the testnet network.
    - Start with a **dry run** to simulate the upgrade.
    - Once verified, apply the upgrade on the live testnet.

7. **Upgrade on Mainnet**:

    - Trigger the upgrade workflow on GitHub and choose the mainnet network.
    - Perform a **dry run** first.
    - Apply the upgrade on the mainnet.
    - Merge the artifacts PR after successful execution.

8. **Refresh the proxy facets on Etherscan**:<br>
   Go to the Etherscan explorer and follow the steps of "Is this a proxy?" to
   refresh the facets list.

9. **Update upgrade report**:<br>
   Fill in all required information in `vX.Y.Z-upgrade-name.ts` (tx hashes, logs, ...).

10. **Create a release**
    - Use **Release Please** to tag the upgraded version and create the release on GitHub.
