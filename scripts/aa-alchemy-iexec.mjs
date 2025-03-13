// scripts/aa-alchemy-iexec.mjs
// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { writeFileSync } from 'fs';
import { createPublicClient, http } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { LocalAccountSigner } from '@aa-sdk/core';
import { alchemy, arbitrumSepolia } from '@account-kit/infra';
import { createModularAccountAlchemyClient } from '@account-kit/smart-contracts';
import { ethers, verifyMessage } from 'ethers';
import {
    createEmptyAppOrder,
    createEmptyWorkerpoolOrder,
    createEmptyRequestOrder,
    hashOrder,
    createEmptyDatasetOrder,
    signOrder,
    signOrderWithSmartAccounttSigner,
    createOrderOperation,
    getDealId,
    getTaskId,
    buildContributionAuthorizationMessage,
    signMessage,
    buildUtf8ResultAndDigest
} from './order-utils.mjs';
import dotenv from 'dotenv';
import {  debugWorkerpoolSignature} from "./odb-tools-utils.mjs";
import { loadAbi } from './contract-abi.mjs';

// Load environment variables
dotenv.config();

const OrderOperationEnum = {
    SIGN: 0,
    CLOSE: 1
};

// Define minimal ABIs directly to avoid import issues
const IexecLibOrdersV5ABI = loadAbi('IexecLibOrders_V5');
const IexecInterfaceTokenABI = loadAbi('IexecInterfaceToken');
const AppRegistryABI =  loadAbi('AppRegistry');
const AppInterfaceABI = loadAbi('AppInterface');
const WorkerpoolRegistryABI = loadAbi('WorkerpoolRegistry');
const WorkerInterfaceABI = loadAbi('WorkerpoolInterface');
const IexecPocoBoostABI = [
    "function matchOrdersBoost(tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) appOrder, tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) datasetOrder, tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign) workerpoolOrder, tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign) requestOrder) returns (bytes32)",
    "function pushResultBoost(bytes32 dealId,uint256 index,bytes results,bytes resultsCallback,bytes authorizationSign,address enclaveChallenge,bytes enclaveSign)",
    "function viewDealBoost(bytes32 id) external view returns (tuple(address appOwner, uint96 appPrice, address datasetOwner, uint96 datasetPrice, address workerpoolOwner, uint96 workerpoolPrice, address requester, uint96 workerReward, address callback, uint40 deadline, uint16 botFirst, uint16 botSize, bytes3 shortTag, address sponsor))"
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
    // const salt = ethers.id(new Date().toISOString());
    const salt = "0xe16a34142459207bd553494bf5a9be746afb15c6b0acda299ca1240f2ca90b84"
    console.log(`Using salt: ${salt}`);

    // Create app order
    console.log('Creating app order...');
    let appOrder = createEmptyAppOrder();
    appOrder.app = appAddress;
    appOrder.volume = 1000;
    appOrder.salt = salt;

    // Sign app order
    console.log('Signing app order...');
    await signOrderWithSmartAccounttSigner(domain, appOrder, smartAccountClient);
    const appOrderHash = await hashOrder(domain, appOrder);
    console.log(`App order signed with hash: ${appOrderHash}`);

    const isAppValidSignature = await iexecProxy.verifySignature(
        smartAccountAddress, 
        appOrderHash,
        appOrder.sign
    );
    
    console.log(`\nSignature Valid for AppOrder ${smartAccountAddress}: ${isAppValidSignature ? 'YES' : 'NO'}`);

    // Get workerpool registry
    const workerpoolRegistryAddress = await iexecProxy.workerpoolregistry();
    console.log(`Workerpool registry address: ${workerpoolRegistryAddress}`);
    const workerpoolRegistry = new ethers.Contract(workerpoolRegistryAddress, WorkerpoolRegistryABI, provider);

    // Use existing workerpool (from EOA)
    const workerpoolAddressEOA = '0xc875c4150c537e1c181eef5c64d901d493cec6a6'; // We'll use the EOA-owned workerpool
    // Check if workerpool is registered
    const isWorkerpoolRegistered = await workerpoolRegistry.isRegistered(workerpoolAddressEOA);
    console.log(`Is workerpool registered: ${isWorkerpoolRegistered}`);

    if (!isWorkerpoolRegistered) {
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
            'worker-eoa-workerpool-1'
        );
        
        console.log('Workerpool creation transaction sent:', createTx.hash);
        const receipt = await createTx.wait();
        console.log(`Workerpool creation confirmed in block ${receipt.blockNumber}`);
        logTx("Workerpool EOA creation", createTx.hash);
    }

    // Worker Signer address: 0x6ef10c3924e7F44a764Ed4346937cf25d036b688
    const worker = workSigner;
    // const enclave = { address: smartAccountAddress };
    const scheduler = workSigner;

    const workerInterface = new ethers.Contract(workerpoolAddressEOA, WorkerInterfaceABI, provider);
    const workerOwner = await workerInterface.owner();
    console.log(`Worker owner: ${workerOwner}`); // 0x6ef10c3924e7F44a764Ed4346937cf25d036b688
    console.log(`Owner matches EOA: ${workerOwner.toLowerCase() === worker.address.toLowerCase()}`);

    // Create workerpool order
    console.log('Creating workerpool order...');
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    
    workerpoolOrder.workerpool = workerpoolAddressEOA; // 0x07018a596ba785847a6ac5b8d1f0fa5dd3fd7727
    workerpoolOrder.volume = 1000;
    workerpoolOrder.salt = salt;

    // Sign workerpool order with worker signer (EOA)
    // console.log('Signing workerpool order with worker signer...');
    await signOrder(domain, workerpoolOrder, scheduler);
    const workerpoolOrderHash = await hashOrder(domain, workerpoolOrder);
    console.log(`Workerpool order signed with hash: ${workerpoolOrderHash}`);

    const isValidSignature = await iexecProxy.verifySignature(
        await workerInterface.owner(), 
        await hashOrder(domain, workerpoolOrder),
        workerpoolOrder.sign
    );
    console.log(`\nSignature Valid for ${await workerInterface.owner()}: ${isValidSignature ? 'YES' : 'NO'}`);
    // console.log(`\nSignature : ${workerpoolOrder.sign}`);

    // console.log('Pre-Signing workerpool order with worker signer...');
    const workSignerWithProvider = workSigner.connect(provider);
    // const iexecProxyWithWorkerSigner = iexecProxy.connect(workSignerWithProvider);
    // const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
    // const presignTx = await iexecProxyWithWorkerSigner.manageWorkerpoolOrder(
    //     orderOperation
    // );
    // console.log('Workerpool presigned transaction sent:', presignTx.hash);
    // const receiptW = await presignTx.wait();
    // console.log(`Workerpool presigned confirmed in block ${receiptW.blockNumber}`);
    // logTx("Workerpool presigned", presignTx.hash);

    // console.log('Workerpool order:', workerpoolOrder);
    // const isValidPreSignatureWorkerPool = await iexecProxy.verifyPresignature(
    //     workerOwner, 
        // await hashOrder(domain, workerpoolOrder),   
    // );
    // console.log(`\nPreSignature Valid for ${workerOwner}: ${isValidPreSignatureWorkerPool ? 'YES' : 'NO'}`);
    // const workerpoolOrderHash = await hashOrder(domain, workerpoolOrder);
    // console.log(`Workerpool order signed with hash: ${workerpoolOrderHash}`);
    // exit(0);
    // console.log(orderOperation);
    // const manageOrder = (await iexecProxy.manageWorkerpoolOrder.populateTransaction(orderOperation))
    //     .data;

    // const userOpResult = await smartAccountClient.sendUserOperation({
    //     uo: {
    //         target: iexecProxyAddress,
    //         data: manageOrder,
    //         value: BigInt(0),
    //     },
    // });
    // const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
    // logTx("Workerpool sign order", txHash);
    // const workerpoolOrderHash = await hashOrder(domain, workerpoolOrder);
    // console.log(`Workerpool order signed with hash: ${workerpoolOrderHash}`);
    // console.log((await iexecProxy.viewPresigned(workerpoolOrderHash)) == account.address);



    // Create request order
    console.log('Creating request order...');
    let requestOrder = createEmptyRequestOrder();
    requestOrder.requester = smartAccountAddress;
    requestOrder.app = appAddress;
    requestOrder.workerpool = workerpoolAddressEOA;
    requestOrder.params = 'my-alchemy-params';
    requestOrder.salt = salt;
    requestOrder.volume = 1000;
    
    // Sign request order with the EOA signer for the smart account
    // const requestOrderOperation = createOrderOperation(requestOrder, OrderOperationEnum.SIGN);
    // const manageRequestOrderData = await iexecProxy.manageRequestOrder.populateTransaction(
    //     requestOrderOperation,
    // ).then(tx => tx.data);

    // const userOpResult_1 = await smartAccountClient.sendUserOperation({
    //     uo: {
    //         target: iexecProxyAddress,
    //         data: manageRequestOrderData,
    //         value: BigInt(0),
    //     },
    // });
    // console.log('Signing request order...');
    // const txHash_1 = await smartAccountClient.waitForUserOperationTransaction(userOpResult_1);
    // logTx("Request presign order", txHash_1);
    await signOrderWithSmartAccounttSigner(domain, requestOrder, smartAccountClient);
    const requestOrderHash = await hashOrder(domain, requestOrder);
    console.log(`Request order signed with hash: ${requestOrderHash}`);
    const isValidSignatureR = await iexecProxy.verifySignature(
        smartAccountAddress, 
        requestOrderHash,
        requestOrder.sign
    );
    console.log(`\nSignature Valid for ${smartAccountAddress}: ${isValidSignatureR ? 'YES' : 'NO'}`);
    // const isValidPreSignature = await iexecProxy.verifyPresignature(
    //     smartAccountAddress, 
    //     requestOrderHash,
    //     // "0xd50ebe2519f6f988c422a08a9377c96fdfd0fb72978381c01a95fe0e83114da3"
    // );
    // console.log(`\nPreSignature Valid for ${smartAccountAddress}: ${isValidPreSignature ? 'YES' : 'NO'}`);


    // Now we can match orders using matchOrdersBoost
    // const matchOrdersData = await iexecBoost.matchOrdersBoost.populateTransaction(
    //     appOrder,
    //     createEmptyDatasetOrder(),
    //     workerpoolOrder,
    //     requestOrder
    // ).then(tx => tx.data);
    // const matchUserOpResult = await smartAccountClient.sendUserOperation({
    //     uo: {
    //         target: iexecProxyAddress,
    //         data: matchOrdersData,
    //         value: BigInt(0),
    //     },
    // });
    // // console.log('User operation hash:', matchUserOpResult.hash);
    // const matchTxHash = await smartAccountClient.waitForUserOperationTransaction(matchUserOpResult);
    // logTx("Match orders", matchTxHash);



    const taskIndex = 0;
    const dealId = getDealId(domain, requestOrder, taskIndex);
    const taskId = getTaskId(dealId, taskIndex);
    console.log(`Task ID for deal ${dealId} and task index ${taskIndex}: ${taskId}`);
    // console.log(await iexecProxy.teebroker());

    const schedulerMessage = buildContributionAuthorizationMessage(
        worker.address,
        taskId,
        ethers.ZeroAddress,
    );
    const schedulerSignatureString = await signMessage(scheduler, schedulerMessage);
    console.log('account : Scheduler.address:', scheduler.address);
    console.log('message : ', schedulerMessage);
    console.log(`Scheduler signature: ${schedulerSignatureString}`);
    const { rawMessage, messageHash, ethSignedMessageHash } = 
    computeMessageHashForVerification(scheduler.address, taskId, ethers.ZeroAddress);

    console.log("Raw message:", ethers.hexlify(rawMessage));
    console.log("Message hash:", messageHash);
    console.log("Ethereum signed message hash:", ethSignedMessageHash);

    const { results, resultDigest } = buildUtf8ResultAndDigest('result');
    console.log(`Result: ${results}`);

    // console.log('Pushing result...');
    console.log('dealId:', dealId);
    const dealBoost = await iexecBoost.viewDealBoost(dealId)
    console.log('Raw deal object:', {
        appOwner: dealBoost.appOwner,
        appPrice: dealBoost.appPrice.toString(),
        datasetOwner: dealBoost.datasetOwner,
        datasetPrice: dealBoost.datasetPrice.toString(),
        workerpoolOwner: dealBoost.workerpoolOwner, 
        workerpoolPrice: dealBoost.workerpoolPrice.toString(),
        requester: dealBoost.requester,
        workerReward: dealBoost.workerReward.toString(),
        callback: dealBoost.callback,
        deadline: dealBoost.deadline.toString(),
        botFirst: dealBoost.botFirst,
        botSize: dealBoost.botSize,
        shortTag: ethers.hexlify(dealBoost.shortTag),
        sponsor: dealBoost.sponsor
      });
    console.log('taskIndex:', taskIndex);
    console.log('results:', results);
    console.log('resultsCallback:', '0x');
    console.log('schedulerSignatureString:', schedulerSignatureString);
    console.log('enclave.address:', ethers.ZeroAddress);
    console.log('enclaveSignatureString:', '0x');

    const pushResultBoostTx = await iexecBoost.connect(workSignerWithProvider)
    .pushResultBoost(
        dealId,
        taskIndex,
        results,
        '0x',
        schedulerSignatureString,
        ethers.ZeroAddress, //enclave.address,
        '0x', //enclaveSignatureString,
    )
    console.log('Scheduler pushResultBoost transaction sent:', pushResultBoostTx.hash);
    const receipt = await pushResultBoostTx.wait();
    console.log(`Scheduler pushResultBoost confirmed in block ${receipt.blockNumber}`);
    logTx("Scheduler pushResultBoost", pushResultBoostTx.hash);
    return {
        appOrder,
        workerpoolOrder,
        requestOrder,
        // matchTxHash,
        smartAccountAddress,
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
        // const result = await main();
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


// export function getTaskId(dealId, index) {
//     // Make sure dealId is a proper hex string
//     if (!dealId.startsWith('0x')) {
//       dealId = '0x' + dealId;
//     }
    
//     // Convert index to BigInt if it's not already
//     const indexBigInt = BigInt(index);
//     console.log("indexBigInt = ", indexBigInt);
    
//     // Use ethers.js to do the encoding
//     const encodedData = ethers.solidityPacked(
//       ['bytes32', 'uint256'],
//       [dealId, indexBigInt]
//     );
    
//     // Hash the encoded data
//     const taskId = ethers.keccak256(encodedData);
    
//     return taskId;
//   }

function computeMessageHashForVerification(workerAddress, taskId, enclaveChallenge) {
// Step 1: Create the raw message (abi.encodePacked(msg.sender, taskId, enclaveChallenge))
const rawMessage = ethers.solidityPacked(
    ['address', 'bytes32', 'address'],
    [workerAddress, taskId, enclaveChallenge]
);

// Step 2: Hash the raw message with keccak256
const messageHash = ethers.keccak256(rawMessage);

// Step 3: Convert to Ethereum signed message hash
// This is what MessageHashUtils.toEthSignedMessageHash does
const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash));

return {
    rawMessage,
    messageHash,
    ethSignedMessageHash
};
}
  
  // Function to verify the signature
  async function verifySignature(contract, schedulerAddress, workerAddress, taskId, enclaveChallenge, signature) {
    const { ethSignedMessageHash } = computeMessageHashForVerification(
      workerAddress, 
      taskId, 
      enclaveChallenge
    );
    
    // Call the contract's verifySignature function
    const isValid = await contract.verifySignature(
      schedulerAddress,
      ethSignedMessageHash,
      signature
    );
    
    // You can also verify locally
    const recoveredAddress = ethers.recoverAddress(ethSignedMessageHash, signature);
    const localVerification = recoveredAddress.toLowerCase() === schedulerAddress.toLowerCase();
    
    return {
      contractVerification: isValid,
      localVerification,
      recoveredAddress,
      ethSignedMessageHash
    };
  }