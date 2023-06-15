import hre from "hardhat";
import fs from "fs";
import {
    IexecPocoBoostDelegate__factory, IexecPocoBoostDelegate,
    ERC1538Proxy,
} from "../typechain";
import { deployAllContracts } from "../test/truffle-fixture-deployer"
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

    saveDeployments("IexecPocoBoostDelegate", iexecPocoBoostInstance.address);
    saveDeployments("ERC1538Proxy", erc1538ProxyAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

// Write deployed manually
// https://ethereum.stackexchange.com/a/134499
// Or write them with hardhat-deploy
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
function saveDeployments(contractName: string, deployedAddress: string) {
    const chainId = hre.network.config.chainId || 0;
    var deployed = {
        [chainId]: deployedAddress,
    };
    fs.writeFileSync(`./build/${contractName}.json`, JSON.stringify(deployed));
}

