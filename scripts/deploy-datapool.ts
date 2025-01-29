import { MulticallWrapper } from 'ethers-multicall-provider';
import { ethers } from 'hardhat';
import { Datapool, Datapool__factory } from '../typechain';

(async () => {
    await deploy();
})();

export async function deploy() {
    console.log('Deploying datapool..');
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    const datapoolAddress = await new Datapool__factory(deployer)
        .deploy()
        .then((tx) => tx.deployed())
        .then((contract) => contract.address);
    console.log(`Datapool: ${datapoolAddress}`);
    // const provider = ethers.getDefaultProvider();
    const provider = MulticallWrapper.wrap(ethers.getDefaultProvider());
    // ethers might already use batch-calls provider internally, lets force one
    console.log(`Using batch-calls provider ${MulticallWrapper.isMulticallProvider(provider)}`);
    let datapool = new ethers.Contract(
        datapoolAddress,
        new Datapool__factory().interface,
        provider,
    ).connect(deployer) as Datapool;

    const datasets = 5;
    await addDatasets(datasets);
    await getDatasets();

    async function addDatasets(datasets: number) {
        console.log('From dataset providers:');
        console.log(`Requested ${datasets} datasets`);
        const addDatasetCalls = [];
        for (let i = 0; i < datasets; i++) {
            const datasetAddress = await ethers.Wallet.createRandom().getAddress();
            addDatasetCalls.push(datapool.addDataset(datasetAddress));
            process.stdout.write(`Preparing datasets: ${i + 1}.. \r`);
        }
        await Promise.all(addDatasetCalls);
        const datasetsCount = Number(await datapool.datasetCount());
        console.log();
        console.log(`Datasets added`);
        console.log(`Dataset count is now: ${datasetsCount}`);
    }

    async function getDatasets() {
        console.log('From SMS:');
        const start = new Date().getTime();
        const datasetsCount = Number(await datapool.datasetCount());
        const getDatasetCalls = [];
        for (let i = 0; i < datasetsCount; i++) {
            getDatasetCalls.push(datapool.datasets(i));
        }
        const allDatasets = await Promise.all(getDatasetCalls);
        console.log(allDatasets);
        console.log(`Dataset found: ${allDatasets.length}`);
        const end = new Date().getTime();
        console.log(`Took ${end - start}ms`);
    }
}
