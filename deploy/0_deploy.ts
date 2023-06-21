import hre from "hardhat";
import fs from "fs";
import path from "path";
import initial_migration from '../migrations/1_initial_migration';
import deploy_token from '../migrations/3_deploy_token';
import deploy_core from '../migrations/4_deploy_core';
import deploy_ens from '../migrations/5_deploy_ens';
import whitelisting from '../migrations/6_whitelisting';
import functions from '../migrations/999_functions';
const erc1538Proxy: ERC1538Proxy =
    hre.artifacts.require('@iexec/solidity/ERC1538Proxy')
import {
    ERC1538Proxy,
    IexecAccessors__factory,
    IexecPocoBoostDelegate, IexecPocoBoostDelegate__factory,
} from "../typechain";

/**
 * @dev Deploying contracts with `npx hardhat deploy` task brought by 
 * `hardhat-deploy` plugin.
 * Previous deployments made with `npx hardhat run scripts/deploy.ts` used to 
 * hang at the end of deployments (terminal did not return at the end).
 * 
 * Note:
 * The`hardhat-deploy` plugin is currently being under used compared to all 
 * features available in it.
 */
module.exports = async function () {
    console.log("Deploying PoCo Nominal..")
    const accounts = await hre.web3.eth.getAccounts()
    await initial_migration()
    await deploy_token(accounts)
    await deploy_core(accounts)
    await deploy_ens(accounts)
    await whitelisting(accounts)
    // Retrieve proxy address from previous truffle-fixture deployment
    const erc1538ProxyAddress = (await erc1538Proxy.deployed()).address;
    if (!erc1538ProxyAddress) {
        console.error("Failed to retrieve deployed address of ERC1538Proxy")
        process.exitCode = 1;
    }
    console.log(`ERC1538Proxy found: ${erc1538ProxyAddress}`);
    // Save addresses of deployed PoCo Nominal contracts for later use
    saveDeployedAddress("ERC1538Proxy", erc1538ProxyAddress);
    
    console.log("Deploying PoCo Boost..")
    const [owner] = await hre.ethers.getSigners();
    const iexecPocoBoostInstance: IexecPocoBoostDelegate =
        await (await new IexecPocoBoostDelegate__factory()
            .connect(owner)
            .deploy())
            .deployed();
    console.log(`IexecPocoBoostDelegate deployed: ${iexecPocoBoostInstance.address}`)

    // Show proxy functions
    //TODO: Link PocoBoost module to ERC1538Proxy
    await functions(accounts)
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
    const filePath = `${BUILD_DIR}/${contractName}.json`;
    fs.writeFileSync(
        path.resolve(__dirname, filePath),
        JSON.stringify(deployedContractJson));
    console.log(`Saved ${deployedAddress} to ${filePath}`)
}
