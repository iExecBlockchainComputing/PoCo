import hre from "hardhat";
import {
    ERC1538Update__factory, ERC1538Update,
    ERC1538Proxy
} from "../typechain";
import { deployAllContracts } from "../test/truffle-fixture-deployer"
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy')

async function main() {
    console.log("About to deploy PoCo Nominal..")
    await deployAllContracts()
    const erc1538ProxyAddress = (await erc1538Proxy.deployed()).address;
    const [owner, otherAccount] = await hre.ethers.getSigners();
    const erc1538: ERC1538Update = ERC1538Update__factory
        .connect(erc1538ProxyAddress, owner);
    console.log(`IexecInstance found at address: ${erc1538.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
