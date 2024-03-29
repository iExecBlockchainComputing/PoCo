// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

async function resetNetworkToInitialState() {
    console.log(
        'Reset network to a fresh state to ensure same initial snapshot state between tests',
    );
    await hre.network.provider.send('hardhat_reset');
}

module.exports = {
    resetNetworkToInitialState,
};
