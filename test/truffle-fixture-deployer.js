const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const initial_migration = require('../migrations/1_initial_migration.js')
const deploy_token = require('../migrations/3_deploy_token.js')
const deploy_core = require('../migrations/4_deploy_core.js')
const deploy_ens = require('../migrations/5_deploy_ens.js')
const whitelisting = require('../migrations/6_whitelisting.js')
const functions = require('../migrations/999_functions.js')

async function deployAllContracts() {
    console.log("Migrating contracts..")
    await initial_migration()
    const accounts = await web3.eth.getAccounts()
    await deploy_token(accounts)
    await deploy_core(accounts)
    await deploy_ens(accounts)
    await whitelisting(accounts)
    await functions(accounts)
}

async function truffleFixtureDeployer() {
    await loadFixture(deployAllContracts);

}

module.exports = {
    truffleFixtureDeployer
};
