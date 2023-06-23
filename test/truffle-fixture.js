
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployAllContracts } = require('../scripts/truffle-fixture-deployer')

module.exports = async () => {
    console.log("Running truffle-fixture hook before hardhat-truffle test")
    // Running all tests at once with`npx hardhat test` requires some fixtures:
    // 1. In `factory deployment` mode a custom truffle-fixture deployer is required
    // Used resources:
    // - https://hardhat.org/hardhat-runner/docs/guides/test-contracts#using-fixtures
    // - https://github.com/NomicFoundation/hardhat/blob/hardhat%402.13.0/packages/hardhat-network-helpers/test/loadFixture.ts#L52
    // 2. In `standard deployment` mode, deployment code can be injected directly
    // in truffle-fixture.js.
    // https://hardhat.org/hardhat-runner/docs/other-guides/truffle-migration#migrations-and-hardhat-truffle-fixtures
    await loadFixture(deployAllContracts);
};
