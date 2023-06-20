import hre from "hardhat";
import fs from "fs";
import path from "path";
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy')
import {
    ERC1538Proxy,
    IexecAccessors__factory,
    IexecPocoBoostDelegate, IexecPocoBoostDelegate__factory,
} from "../typechain";

const initial_migration = require('../migrations/1_initial_migration.js')
const deploy_token = require('../migrations/3_deploy_token.js')
const deploy_core = require('../migrations/4_deploy_core.js')
const deploy_ens = require('../migrations/5_deploy_ens.js')
const whitelisting = require('../migrations/6_whitelisting.js')
const functions = require('../migrations/999_functions.js')

module.exports = async function () {
    const [owner] = await hre.ethers.getSigners();

    console.log("Migrating contracts..")
    await initial_migration()
    const accounts = await hre.web3.eth.getAccounts()
    await deploy_token(accounts)
    await deploy_core(accounts)
    await deploy_ens(accounts)
    await whitelisting(accounts)
    await functions(accounts)

    // Retrieve proxy address from previous truffle-fixture deployment
    const erc1538ProxyAddress = (await erc1538Proxy.deployed()).address;
    if (!erc1538ProxyAddress) {
        console.error("Failed to retrieve deployed address of ERC1538Proxy")
        process.exitCode = 1;
    }
    console.log(`ERC1538Proxy found: ${erc1538ProxyAddress}`);
    // Save addresses of deployed PoCo Nominal contracts for later use
    saveDeployedAddress("ERC1538Proxy", erc1538ProxyAddress);
    if (process.env.CHAIN_TYPE == "token") {
        // Retrieve token address from IexecAccessors
        saveDeployedAddress("RLC", await IexecAccessors__factory
            .connect(erc1538ProxyAddress, owner).token());
    }

    console.log("Deploying PoCo Boost..")
    const iexecPocoBoostInstance: IexecPocoBoostDelegate =
        await (await new IexecPocoBoostDelegate__factory()
            .connect(owner)
            .deploy())
            .deployed();
    console.log(`IexecPocoBoostDelegate deployed: ${iexecPocoBoostInstance.address}`)
    // Save addresses of deployed PoCo Boost contracts for later use
    saveDeployedAddress("IexecPocoBoostDelegate", iexecPocoBoostInstance.address);
};

// TODO [optional]: Use hardhat-deploy to save addresses automatically
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
/**
 * Save addresses of deployed contracts (since hardhat does not do it for us).
 * @param contractName contract name to deploy
 * @param deployedAddress address where contract where deployed
 */
function saveDeployedAddress(contractName: string, deployedAddress: string) {
    const chainId = hre.network.config.chainId || 0;
    var deployedContractJson = {
        "networks": {
            [chainId]: {
                "address": deployedAddress
            }
        }
    };
    const BUILD_DIR = '../build';
    // Create parent dir if missing
    fs.mkdir(path.join(__dirname, BUILD_DIR), () => { });
    const filePath = `${BUILD_DIR}/${contractName}.json`;
    fs.writeFileSync(
        path.resolve(__dirname, filePath),
        JSON.stringify(deployedContractJson));
    console.log(`Saved ${deployedAddress} to ${filePath}`)
}
