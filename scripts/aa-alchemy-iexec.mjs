// scripts/aa-alchemy-iexec.mjs
// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { writeFileSync } from 'fs';
import { createPublicClient, http } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { LocalAccountSigner } from '@aa-sdk/core';
import { alchemy, arbitrumSepolia } from '@account-kit/infra';
import { createModularAccountAlchemyClient } from '@account-kit/smart-contracts';
import { ethers } from 'ethers';
import {
    createEmptyAppOrder,
    createEmptyWorkerpoolOrder,
    createEmptyRequestOrder,
    hashOrder,
    createEmptyDatasetOrder,
    signOrder,
    signOrderWithSmartAccounttSigner
} from './order-utils.mjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define minimal ABIs directly to avoid import issues
const IexecInterfaceTokenABI = [
    "function appregistry() view returns (address)",
    "function workerpoolregistry() view returns (address)",
    "function viewPresigned(bytes32) view returns (address)",
    "function manageWorkerpoolOrder(tuple(uint256 status, bytes32 order, uint8 preinfo, bytes sig)) returns (bool)",
    "function manageRequestOrder(tuple(uint256 status, bytes32 order, uint8 preinfo, bytes sig)) returns (bool)",
    "function teebroker() view returns (address)"
];

const AppRegistryABI = [
    "function createApp(address _owner, string calldata _appName, string calldata _appType, bytes calldata _appMultiaddr, bytes32 _appChecksum, bytes calldata _appMREnclave) returns (address)",
    "function isRegistered(address _app) external view returns (bool)"
];

const AppInterfaceABI = [
    "function owner() view returns (address)"
];

const WorkerpoolRegistryABI = [
    "function createWorkerpool(address _owner, string calldata _workerpoolDescription) returns (address)",
    "function isRegistered(address _workerpool) external view returns (bool)"
];
const WorkerInterfaceABI = [
    "function owner() view returns (address)"
];

const IexecPocoBoostABI = [
    "function matchOrdersBoost(tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) appOrder, tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) datasetOrder, tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign) workerpoolOrder, tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign) requestOrder) returns (bytes32)",
    
    "function sponsorMatchOrdersBoost(tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) appOrder, tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) datasetOrder, tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign) workerpoolOrder, tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign) requestOrder) returns (bytes32)",
    
    "function pushResultBoost(bytes32 _dealid, uint256 _taskindex, string calldata _results, bytes calldata _resultsCallback, bytes calldata _authorization, address _enclave, bytes calldata _enclaveSignature) external returns ()"
];
  
async function main() {
    console.log('Starting Alchemy-based Account Abstraction script for iExec');

    // Get environment variables
    const PRIVATE_KEY = process.env.PRIVATE_KEY_2 || process.env.PRIVATE_KEY || (() => {
        const pk = generatePrivateKey();
        writeFileSync('.env', `PRIVATE_KEY_2=${pk}`);
        return pk;
    })();

    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
    if (!ALCHEMY_API_KEY) throw new Error('Missing ALCHEMY_API_KEY in .env file');

    const POLICY_ID = process.env.POLICY_ID;
    if (!POLICY_ID) throw new Error('Missing POLICY_ID in .env file');

    const WORK_PK = process.env.WORK_PK || (() => {
        const pk = generatePrivateKey();
        writeFileSync('.env', `WORK_PK=${pk}`);
        return pk;
    })();

    console.log('Environment variables loaded');

    // Create EOA signer for compatibility with existing code
    const pkToUse = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const workPkToUse = WORK_PK.startsWith('0x') ? WORK_PK : `0x${WORK_PK}`;

    const eoaSigner = new ethers.Wallet(pkToUse);
    console.log('EOA Signer address:', eoaSigner.address);

    const workSigner = new ethers.Wallet(workPkToUse);
    console.log('Worker Signer address:', workSigner.address);

    // Create viemSigner for Account Kit
    const viemSigner = LocalAccountSigner.privateKeyToAccountSigner(pkToUse);

    // Create Viem public client for blockchain interactions
    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(`https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
    });

    // Create Alchemy Account Kit client
    console.log('Setting up Alchemy Smart Account client...');

    const smartAccountClient = await createModularAccountAlchemyClient({
        transport: alchemy({ apiKey: ALCHEMY_API_KEY }),
        chain: arbitrumSepolia,
        signer: viemSigner,
        policyId: POLICY_ID,
    });

    const smartAccountAddress = smartAccountClient.account.address;
    console.log(`Smart account address: https://sepolia.arbiscan.io/address/${smartAccountAddress}`);

    // Check if account is deployed
    const code = await publicClient.getBytecode({ address: smartAccountAddress });
    console.log("Account deployed:", code && code !== '0x' ? "Yes" : "No");

    // Create a provider for ethers contract interactions
    const provider = new ethers.JsonRpcProvider(`https://lb.drpc.org/ogrpc?network=arbitrum-sepolia&dkey=AhEPbH3buE5zjj_dDMs3E2j3kZBSoroR7oQSjv5J234Y`);

    // Connect to iExec proxy contract
    const iexecProxyAddress = '0x61b18b60a83bf11db697c4a7aafb8d3d947ac81c';
    console.log(`Connecting to iExec proxy at ${iexecProxyAddress}`);
    const iexecProxy = new ethers.Contract(iexecProxyAddress, IexecInterfaceTokenABI, provider);
    const iexecBoost = new ethers.Contract(iexecProxyAddress, IexecPocoBoostABI, provider);
    
    // Set up domain for signing (if needed later)
    const chainId = Number((await provider.getNetwork()).chainId);
    const domain = {
      name: 'iExecODB',
      version: '5.0.0',
      chainId: chainId,
      verifyingContract: iexecProxyAddress,
    };
    console.log('Domain:', domain);

    // Get app registry address
    const appRegistryAddress = await iexecProxy.appregistry();
    console.log(`App registry address: ${appRegistryAddress}`);
    // Set up app registry contract
    const appRegistry = new ethers.Contract(appRegistryAddress, AppRegistryABI, provider);
    
    // Use predefined app or create a new one
    let appAddress = '0x957e1ecc70b57acd432d31cc16151eedb6303dad'; // Use existing app if available
    const isAppRegistered = await appRegistry.isRegistered(appAddress);
    console.log(`Is app registered: ${isAppRegistered}`);
  
    if (!isAppRegistered) {
        console.log('App not registered, creating a new one...');
        // Create transaction data for creating an app
        const createAppData = await appRegistry.createApp.populateTransaction(
            smartAccountAddress, // Using the smart account as the owner
            'my-alchemy-app-1',
            'DOCKER',
            ethers.toUtf8Bytes('docker.io/hello-world:1.0.0'),
            ethers.ZeroHash,
            ethers.ZeroHash,
        ).then(tx => tx.data);

        const userOpResult = await smartAccountClient.sendUserOperation({
            uo: {
                target: appRegistryAddress,
                data: createAppData,
                value: BigInt(0),
            },
        });

        // console.log('User operation hash:', userOpResult.hash);
        const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
        logTx("App creation", txHash);
    }
    // Verify app ownership
    const appInterface = new ethers.Contract(appAddress, AppInterfaceABI, provider);
    const appOwner = await appInterface.owner();
    console.log(`App owner: ${appOwner}`);
    console.log(`Owner matches smart account: ${appOwner.toLowerCase() === smartAccountAddress.toLowerCase()}`);

    // Generate order salt
    const salt = ethers.id(new Date().toISOString());
    console.log(`Using salt: ${salt}`);

    // Create app order
    console.log('Creating app order...');
    let appOrder = createEmptyAppOrder();
    appOrder.app = appAddress;
    appOrder.volume = 10;
    appOrder.salt = salt;

    // Sign app order
    console.log('Signing app order...');
    await signOrderWithSmartAccounttSigner(domain, appOrder, smartAccountClient);
    const appOrderHash = await hashOrder(domain, appOrder);
    console.log(`App order signed with hash: ${appOrderHash}`);

    // Get workerpool registry
    const workerpoolRegistryAddress = await iexecProxy.workerpoolregistry();
    console.log(`Workerpool registry address: ${workerpoolRegistryAddress}`);
    const workerpoolRegistry = new ethers.Contract(workerpoolRegistryAddress, WorkerpoolRegistryABI, provider);

    // Use existing workerpool (from EOA)
    const workerpoolAddressEOA = '0x07018a596ba785847a6ac5b8d1f0fa5dd3fd7727'; // We'll use the EOA-owned workerpool

    // Check if workerpool is registered
    const isWorkerpoolRegistered = await workerpoolRegistry.isRegistered(workerpoolAddressEOA);
    console.log(`Is workerpool registered: ${isWorkerpoolRegistered}`);

    if (!workerpoolAddressEOA) {
        console.error('Workerpool not registered, please use a registered workerpool');
        // const createWorkerpool = await workerpoolRegistry.createWorkerpool.populateTransaction(
        //     smartAccountAddress,
        //     'worker-SCA-workerpool',
        // ).then(tx => tx.data);

        // const userOpResult = await smartAccountClient.sendUserOperation({
        //     uo: {
        //         target: workerpoolRegistryAddress,
        //         data: createWorkerpool,
        //         value: BigInt(0),
        //     },
        // });

        // // console.log('User operation hash:', userOpResult.hash);
        // const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
        // logTx("Workerpool SA creation", txHash);
        // const workerpoolAddressSCA = '0xd30c44ec2afe693e21e81444666be938e23849e5'; // We'll use the SCA-owned workerpool

        const workSignerWithProvider = workSigner.connect(provider);
        const workerpoolRegistryWithSigner = workerpoolRegistry.connect(workSignerWithProvider);
        const createTx = await workerpoolRegistryWithSigner.createWorkerpool(
            workSigner.address,
            'worker-eoa-workerpool'
        );
        
        console.log('Workerpool creation transaction sent:', createTx.hash);
        const receipt = await createTx.wait();
        console.log(`Workerpool creation confirmed in block ${receipt.blockNumber}`);
        logTx("Workerpool EOA creation", createTx.hash);
    }
    const worker = workSigner;
    const enclave = { address: smartAccountAddress };
    const scheduler = workSigner;

    const workerInterface = new ethers.Contract(workerpoolAddressEOA, WorkerInterfaceABI, provider);
    const workerOwner = await workerInterface.owner();
    console.log(`Worker owner: ${workerOwner}`);
    console.log(`Owner matches smart account: ${workerOwner.toLowerCase() === worker.address.toLowerCase()}`);

    // Create workerpool order
    console.log('Creating workerpool order...');
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    workerpoolOrder.workerpool = workerpoolAddressEOA;
    workerpoolOrder.volume = 10;
    workerpoolOrder.salt = salt;

    // Sign workerpool order with worker signer (EOA)
    console.log('Signing workerpool order with worker signer...');
    await signOrder(domain, workerpoolOrder, scheduler);
    const workerpoolOrderHash = await hashOrder(domain, workerpoolOrder);
    console.log(`Workerpool order signed with hash: ${workerpoolOrderHash}`);

    // Create request order
    console.log('Creating request order...');
    let requestOrder = createEmptyRequestOrder();
    requestOrder.requester = smartAccountAddress;
    requestOrder.app = appAddress;
    requestOrder.workerpool = workerpoolAddressEOA;
    requestOrder.params = 'my-alchemy-params';
    requestOrder.salt = salt;
    
    // Sign request order with the EOA signer for the smart account
    console.log('Signing request order...');
    await signOrderWithSmartAccounttSigner(domain, requestOrder, smartAccountClient);
    const requestOrderHash = await hashOrder(domain, requestOrder);
    console.log(`Request order signed with hash: ${requestOrderHash}`);

    // Now we can match orders using matchOrdersBoost
    console.log('Matching orders...');
    const matchOrdersData = await iexecBoost.matchOrdersBoost.populateTransaction(
        appOrder,
        createEmptyDatasetOrder(),
        workerpoolOrder,
        requestOrder
    ).then(tx => tx.data);
    const matchUserOpResult = await smartAccountClient.sendUserOperation({
        uo: {
            target: iexecProxyAddress,
            data: matchOrdersData,
            value: BigInt(0),
        },
    });
    // console.log('User operation hash:', matchUserOpResult.hash);
    const matchTxHash = await smartAccountClient.waitForUserOperationTransaction(matchUserOpResult);
    logTx("Match orders", matchTxHash);
    
    return {
        appOrder,
        workerpoolOrder,
        requestOrder,
        matchTxHash,
        smartAccountAddress,
        domain
    };
}

// Helper function to log transaction URLs
function logTx(description, txHash) {
  console.log(description, `transaction included: https://sepolia.arbiscan.io/tx/${txHash}`);
}

// Run the main function
console.log('Starting Account Abstraction for iExec...');
try {
    const result = await main();
    console.log("Transaction successful!");
    if (result) {
        const result = await main();
        console.log("Order matching successful!");
        console.log("Orders summary:");
        console.log(" - App order for app:", result.appOrder.app);
        console.log(" - Workerpool order for workerpool:", result.workerpoolOrder.workerpool);
        console.log(" - Request order from requester:", result.requestOrder.requester);
        console.log(" - Match transaction:", result.matchTxHash);
    }
} catch (err) {
    console.error("Error in execution:", err);
} finally {
    console.log("\n--- SCRIPT COMPLETED ---");
}
