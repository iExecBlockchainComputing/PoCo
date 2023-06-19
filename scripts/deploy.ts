import hre from "hardhat";
import fs from "fs";
import path from "path";
import {
    ERC1538Proxy,
    IexecAccessors__factory,
    IexecPocoBoostDelegate__factory, IexecPocoBoostDelegate,
} from "../typechain";
import { deployAllContracts } from "./truffle-fixture-deployer"
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy')

async function main() {
    console.log("About to deploy PoCo Nominal..")

    await deployAllContracts()

    const erc1538ProxyAddress = (await erc1538Proxy.deployed()).address;
    const [owner] = await hre.ethers.getSigners();
    console.log(`IexecInstance found at address: ${erc1538ProxyAddress}`);

    const iexecPocoBoostInstance: IexecPocoBoostDelegate =
        await (await new IexecPocoBoostDelegate__factory()
            .connect(owner)
            .deploy())
            .deployed();
    console.log(`IexecPocoBoostDelegate successfully deployed at ${iexecPocoBoostInstance.address}`)

    // Store addresses of deployed contracts
    storeDeployedAddress("IexecPocoBoostDelegate", iexecPocoBoostInstance.address);
    storeDeployedAddress("ERC1538Proxy", erc1538ProxyAddress);
    if (process.env.CHAIN_TYPE == "token") {
        storeDeployedAddress("RLC", await IexecAccessors__factory
            .connect(erc1538ProxyAddress, owner).token());
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// TODO [optional]: Use hardhat-deploy to store addresses automatically
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
/**
 * Store addresses of deployed contracts (since hardhat does not do it for us).
 * @param contractName contract name to deploy
 * @param deployedAddress address where contract where deployed
 */
function storeDeployedAddress(contractName: string, deployedAddress: string) {
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
        fs.writeFileSync(
            path.resolve(__dirname, `${BUILD_DIR}/${contractName}.json`),
            JSON.stringify(deployedContractJson));
    });
}
