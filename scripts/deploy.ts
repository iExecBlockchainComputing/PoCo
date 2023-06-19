import hre from "hardhat";
import fs from "fs";
import path from "path";
import { deployAllContracts } from "./truffle-fixture-deployer"
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy')
import {
    ERC1538Proxy,
    IexecAccessors__factory,
    IexecPocoBoostDelegate, IexecPocoBoostDelegate__factory,
} from "../typechain";

async function main() {
    const [owner] = await hre.ethers.getSigners();

    console.log("Deploying PoCo Nominal..")
    await deployAllContracts()
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

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
    fs.mkdir(path.join(__dirname, BUILD_DIR), (err) => {
        const filePath = `${BUILD_DIR}/${contractName}.json`;
        fs.writeFileSync(
            path.resolve(__dirname, filePath),
            JSON.stringify(deployedContractJson));
        console.log(`Saved ${deployedAddress} to ${filePath}`)
    });
}
