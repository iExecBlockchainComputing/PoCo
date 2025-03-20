import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { ethers } from 'hardhat';
import {
    App__factory,
    AppRegistry__factory,
    IexecInterfaceNative__factory,
    LaPoste,
    LaPoste__factory,
} from '../typechain';
import { MULTIADDR_BYTES } from '../utils/constants';
import { bigintToAddress } from '../utils/tools';

// Contract addresses
const SEPOLIA_LAPOSTE_ADDRESS = '0x9788F051689f7C6Eba9238dc5583FdE5b6A8B525';
const ARBITRUM_SEPOLIA_LAPOSTE_ADDRESS = '0xf8931C835703F8b999DC52165B628448ea3ba5aC';

// Chain selectors for CCIP
const SEPOLIA_CHAIN_SELECTOR = '16015286601757825753';
const ARBITRUM_SEPOLIA_CHAIN_SELECTOR = '3478487238524512106';

const PROXY_ADDRESS = '0x4AB8068bE5bd7C693EA7F5cF0701D973Da005c2f';

async function deployAppFromSepoliaToArbitrum() {
    console.log('Starting App transfer from Sepolia to Arbitrum Sepolia');
    const [owner] = await ethers.getSigners();
    console.log(`Using signer with address: ${owner.address}`);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    expect(chainId).to.equal(
        11155111,
        'You are on the wrong network, you should select sepolia testnet',
    );

    // Connect to Sepolia LaPoste contract
    console.log('Connecting to Sepolia LaPoste contract...');
    const sepoliaLaPoste = LaPoste__factory.connect(SEPOLIA_LAPOSTE_ADDRESS, owner) as LaPoste;

    // Get App Registry address from LaPoste
    const appRegistryAddress = await sepoliaLaPoste.appRegistry();
    const iexecPoco = IexecInterfaceNative__factory.connect(PROXY_ADDRESS, owner);
    const appRegistry = AppRegistry__factory.connect(await iexecPoco.appregistry(), owner);
    expect(appRegistryAddress).to.equal(
        await iexecPoco.appregistry(),
        'Both AppRegistryAddress in IexecPoco and LaPoste contract are not the same',
    );
    console.log(`App Registry address: ${appRegistryAddress}`);

    const createAppArgs = [
        `App` + '-' + Date.now().toString(),
        'DOCKER',
        MULTIADDR_BYTES,
        ethers.id(`My app checksum`),
        '0x1234',
    ] as [string, string, BytesLike, BytesLike, BytesLike];
    const appAddress = await appRegistry.predictApp(owner.address, ...createAppArgs);
    const txAppCreation = await appRegistry.createApp(owner.address, ...createAppArgs);
    await txAppCreation.wait();
    console.log(`App deployed: ${appAddress}`);

    // Connect to the App contract to verify it exists and we have access to it
    const app = App__factory.connect(appAddress, owner);
    console.log('App Name:', await app.m_appName());
    const appOwner = await appRegistry.ownerOf(BigInt(appAddress));
    expect(appOwner).to.equal(owner.address, 'Invalid App Owner');
    console.log(`App owner: ${appOwner}`);

    // First, approve LaPoste to transfer the App NFT
    console.log('Approving LaPoste to transfer App NFT...');
    expect(bigintToAddress(BigInt(appAddress))).to.equal(appAddress);
    const txApproval = await appRegistry.approve(SEPOLIA_LAPOSTE_ADDRESS, BigInt(appAddress));
    await txApproval.wait();
    console.log('Approval completed');

    // Verify the approval
    const approved = await appRegistry.getApproved(BigInt(appAddress));
    console.log(`Approved address for App: ${approved}`);
    expect(approved.toLowerCase()).to.equal(SEPOLIA_LAPOSTE_ADDRESS.toLowerCase());

    // Lock and bridge the App
    console.log('Locking and bridging App to Arbitrum Sepolia...');
    // PayFeesIn enum: 0 = NATIVE, 1 = LINK
    const payFeesIn = 0; // Using native currency for fees
    // Execute the transaction
    const data = (
        await sepoliaLaPoste.lockAndBridgeApp.populateTransaction(
            appAddress,
            ARBITRUM_SEPOLIA_CHAIN_SELECTOR,
            payFeesIn,
        )
    ).data;
    console.log('Transaction Data sent:', data);
    const tx = await sepoliaLaPoste.lockAndBridgeApp(
        appAddress,
        ARBITRUM_SEPOLIA_CHAIN_SELECTOR,
        payFeesIn,
    );
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

    // Extract the messageId from the event
    const crossChainSentEvent = receipt?.logs.find((log) => {
        const parsedLog = sepoliaLaPoste.interface.parseLog(log);
        return parsedLog?.name === 'CrossChainSent';
    });

    // If you need to access the event args
    const parsedLog = sepoliaLaPoste.interface.parseLog(crossChainSentEvent!);
    const messageId = parsedLog?.args[0];
    console.log(`CCIP Message ID: ${messageId}`);

    // Note: The app will be bridged to Arbitrum Sepolia and will be available there after the CCIP message is processed
    // To verify, you would need to wait for the CCIP message to be processed and then check on Arbitrum Sepolia
    console.log(
        '\nTransfer initiated successfully. The App is now being bridged to Arbitrum Sepolia.',
    );
    console.log(
        'To verify the transfer completion, monitor the CCIP message status and then check for the App on Arbitrum Sepolia.',
    );
}

async function deployAppFromArbitrumToSepolia() {
    console.log('Starting App transfer from Arbitrum Sepolia to Sepolia');
    const [owner] = await ethers.getSigners();
    console.log(`Using signer with address: ${owner.address}`);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    expect(chainId).to.equal(
        421614,
        'You are on the wrong network, you should select arbitrum sepolia testnet',
    );

    // Connect to Arbitrum Sepolia LaPoste contract
    console.log('Connecting to Arbitrum Sepolia LaPoste contract...');
    const arbitrumLaPoste = LaPoste__factory.connect(
        ARBITRUM_SEPOLIA_LAPOSTE_ADDRESS,
        owner,
    ) as LaPoste;

    // Get App Registry address from LaPoste
    const appRegistryAddress = await arbitrumLaPoste.appRegistry();
    const iexecPoco = IexecInterfaceNative__factory.connect(PROXY_ADDRESS, owner);
    const appRegistry = AppRegistry__factory.connect(await iexecPoco.appregistry(), owner);
    expect(appRegistryAddress).to.equal(
        await iexecPoco.appregistry(),
        'Both AppRegistryAddress in IexecPoco and LaPoste contract are not the same',
    );
    console.log(`App Registry address: ${appRegistryAddress}`);

    const createAppArgs = [
        `App` + '-' + Date.now().toString(),
        'DOCKER',
        MULTIADDR_BYTES,
        ethers.id(`My app checksum`),
        '0x1234',
    ] as [string, string, BytesLike, BytesLike, BytesLike];
    const appAddress = await appRegistry.predictApp(owner.address, ...createAppArgs);
    const txAppCreation = await appRegistry.createApp(owner.address, ...createAppArgs);
    await txAppCreation.wait();
    console.log(`App deployed: ${appAddress}`);

    // Connect to the App contract to verify it exists and we have access to it
    const app = App__factory.connect(appAddress, owner);
    console.log('App Name:', await app.m_appName());
    const appOwner = await appRegistry.ownerOf(BigInt(appAddress));
    expect(appOwner).to.equal(owner.address, 'Invalid App Owner');
    console.log(`App owner: ${appOwner}`);

    // First, approve LaPoste to transfer the App NFT
    console.log('Approving LaPoste to transfer App NFT...');
    expect(bigintToAddress(BigInt(appAddress))).to.equal(appAddress);
    const txApproval = await appRegistry.approve(
        ARBITRUM_SEPOLIA_LAPOSTE_ADDRESS,
        BigInt(appAddress),
    );
    await txApproval.wait();
    console.log('Approval completed');

    // Verify the approval
    const approved = await appRegistry.getApproved(BigInt(appAddress));
    console.log(`Approved address for App: ${approved}`);
    expect(approved.toLowerCase()).to.equal(ARBITRUM_SEPOLIA_LAPOSTE_ADDRESS.toLowerCase());

    // Lock and bridge the App
    console.log('Locking and bridging App to Sepolia...');
    // PayFeesIn enum: 0 = NATIVE, 1 = LINK
    const payFeesIn = 0; // Using native currency for fees
    // Execute the transaction
    const data = (
        await arbitrumLaPoste.lockAndBridgeApp.populateTransaction(
            appAddress,
            SEPOLIA_CHAIN_SELECTOR,
            payFeesIn,
        )
    ).data;
    console.log('Transaction Data sent:', data);
    const tx = await arbitrumLaPoste.lockAndBridgeApp(
        appAddress,
        SEPOLIA_CHAIN_SELECTOR,
        payFeesIn,
    );
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

    // Extract the messageId from the event
    const crossChainSentEvent = receipt?.logs.find((log) => {
        const parsedLog = arbitrumLaPoste.interface.parseLog(log);
        return parsedLog?.name === 'CrossChainSent';
    });

    // If you need to access the event args
    const parsedLog = arbitrumLaPoste.interface.parseLog(crossChainSentEvent!);
    const messageId = parsedLog?.args[0];
    console.log(`CCIP Message ID: ${messageId}`);

    // Note: The app will be bridged to Sepolia and will be available there after the CCIP message is processed
    console.log('\nTransfer initiated successfully. The App is now being bridged to Sepolia.');
    console.log(
        'To verify the transfer completion, monitor the CCIP message status and then check for the App on Sepolia.',
    );
}

async function main() {
    // await deployAppFromSepoliaToArbitrum();
    await deployAppFromArbitrumToSepolia();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
