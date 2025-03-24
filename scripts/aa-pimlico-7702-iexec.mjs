// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { writeFileSync, existsSync,readFileSync  } from 'fs';
import { createPublicClient, http, zeroAddress, createWalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { odysseyTestnet } from "viem/chains"
import { eip7702Actions } from "viem/experimental"

import { ethers } from 'ethers';
import {
    createEmptyAppOrder,
    createEmptyWorkerpoolOrder,
    createEmptyRequestOrder,
    createEmptyDatasetOrder,
    hashOrder,
    signOrder,
    signOrderWithPimlicoSmartAccountSigner,
    getDealId,
    getTaskId,
    buildContributionAuthorizationMessage,
    signMessage,
    buildUtf8ResultAndDigest,
    createOrderOperation
} from './order-utils.mjs';
import { getDomain } from './odb-tools-utils.mjs';
import dotenv from 'dotenv';
import { loadAbi } from './contract-abi.mjs';
import { getSafeModuleSetupData } from './getSetupData.mjs';
import { safeAbiImplementation } from "./safeAbi.mjs";

// Load environment variables
dotenv.config();

// Constants
const IEXEC_PROXY_ADDRESS = '0xC7e170b0a96131CC6368bF38a96D5EDDdAdfA711';
const salt = generateSalt();
const OrderOperationEnum = {
    SIGN: 0,
};
// Helper Functions
/**
 * Load a private key from environment or generate a new one
 */
function loadOrGeneratePrivateKey(envVar, saveAs = null) {
    const key = process.env[envVar] || (() => {
        const pk = generatePrivateKey();
        if (saveAs) writeFileSync('.env', `${saveAs}=${pk}\n`, { flag: 'a' });
        return pk;
    })();
    
    return key.startsWith('0x') ? key : `0x${key}`;
}
/**
 * Initialize provider and contract instances
 */
function initializeContracts() {
    const provider = new ethers.JsonRpcProvider(odysseyTestnet.rpcUrls.default.http[0]);
    
    const IexecInterfaceTokenABI = loadAbi('IexecInterfaceToken');
    const IexecPocoBoostABI = [
        "function matchOrdersBoost(tuple(address app, uint256 appprice, uint256 volume, bytes32 tag, address datasetrestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) appOrder, tuple(address dataset, uint256 datasetprice, uint256 volume, bytes32 tag, address apprestrict, address workerpoolrestrict, address requesterrestrict, bytes32 salt, bytes sign) datasetOrder, tuple(address workerpool, uint256 workerpoolprice, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address apprestrict, address datasetrestrict, address requesterrestrict, bytes32 salt, bytes sign) workerpoolOrder, tuple(address app, uint256 appmaxprice, address dataset, uint256 datasetmaxprice, address workerpool, uint256 workerpoolmaxprice, address requester, uint256 volume, bytes32 tag, uint256 category, uint256 trust, address beneficiary, address callback, string params, bytes32 salt, bytes sign) requestOrder) returns (bytes32)",
        "function pushResultBoost(bytes32 dealId,uint256 index,bytes results,bytes resultsCallback,bytes authorizationSign,address enclaveChallenge,bytes enclaveSign)",
        "function viewDealBoost(bytes32 id) external view returns (tuple(address appOwner, uint96 appPrice, address datasetOwner, uint96 datasetPrice, address workerpoolOwner, uint96 workerpoolPrice, address requester, uint96 workerReward, address callback, uint40 deadline, uint16 botFirst, uint16 botSize, bytes3 shortTag, address sponsor))"
    ];    
    const AppRegistryABI = loadAbi('AppRegistry');
    const AppInterfaceABI = loadAbi('AppInterface');
    const WorkerpoolRegistryABI = loadAbi('WorkerpoolRegistry');
    const WorkerInterfaceABI = loadAbi('WorkerpoolInterface');

    const iexecProxy = new ethers.Contract(IEXEC_PROXY_ADDRESS, IexecInterfaceTokenABI, provider);
    const iexecBoost = new ethers.Contract(IEXEC_PROXY_ADDRESS, IexecPocoBoostABI, provider);
    console.log(`Connecting to iExec proxy at ${IEXEC_PROXY_ADDRESS}`);

    
    return { 
        provider, 
        iexecProxy, 
        iexecBoost,
        AppRegistryABI,
        AppInterfaceABI,
        WorkerpoolRegistryABI,
        WorkerInterfaceABI 
    };
}

async function createSmartAccountPimlicoProvider(eoaPrivateKey, safePrivateKey, pimlicoUrl) {
    console.log('Setting up Pimlico Smart Account client...');

    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl)
    })
    const publicClient = createPublicClient({
        chain: odysseyTestnet,
        transport: http(odysseyTestnet.rpcUrls.default.http[0]),
    }) 
    
    const safeAccount = await toSafeSmartAccount({
        address: privateKeyToAddress(eoaPrivateKey),
        owners : [privateKeyToAccount(safePrivateKey)],
        client: publicClient, 
        version: "1.4.1",
    })
    
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        paymaster: pimlicoClient,
        bundlerTransport: http(pimlicoUrl),
        userOperation : {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        }
    })

    // Create Pimlico Account Kit client

    const smartAccountAddress = smartAccountClient.account.address;
    console.log(`Smart account address: https://odyssey-explorer.ithaca.xyz/address/${smartAccountAddress}`);

    // Check if account is deployed
    const code = await publicClient.getBytecode({ address: smartAccountAddress });
    const isDeployed = code && code !== '0x';
    console.log("Account deployed:", isDeployed ? "Yes" : "No");
    if (!isDeployed) {
        await deploySafeSmartAccount(eoaPrivateKey, safePrivateKey, pimlicoClient, smartAccountAddress);
        const updatedCode = await publicClient.getBytecode({ address: smartAccountAddress });
        console.log("Account deployment verified:", updatedCode && updatedCode !== '0x' ? "Success" : "Failed");
    }

    return {
        pimlicoClient,
        publicClient,
        safeAccount,
        smartAccountClient,
        smartAccountAddress
    };
}

async function deploySafeSmartAccount(eoaPrivateKey, safePrivateKey, publicClient, expectedAddress) {
    console.log('Deploying Safe Smart Account using EIP-7702...');
    
    // Create wallet client with EIP-7702 extension
    const account = privateKeyToAccount(eoaPrivateKey);
    console.log(`Using deployer account: https://explorer-odyssey.t.conduit.xyz/address/${account.address}`);
    const walletClient = createWalletClient({
        account, 
        chain: odysseyTestnet, 
        transport: http("https://odyssey.ithaca.xyz"), 
    }).extend(eip7702Actions());

    // Gnosis Safe singleton contract address
    const SAFE_SINGLETON_ADDRESS = "0x41675C099F32341bf84BFc5382aF534df5C7461a";
    
    // Sign authorization for EIP-7702 deployment
    const authorization = await walletClient.signAuthorization({
        contractAddress: SAFE_SINGLETON_ADDRESS, 
    });

    // Safe configuration constants
    const SAFE_MULTISEND_ADDY = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";
    const SAFE_4337_MODULE_ADDRESS = "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226";

    // Setup Safe parameters
    const owners = [privateKeyToAddress(safePrivateKey)];
    const signerThreshold = 1n;
    const setupAddress = SAFE_MULTISEND_ADDY;
    const setupData = getSafeModuleSetupData(); 
    const fallbackHandler = SAFE_4337_MODULE_ADDRESS;
    const paymentToken = zeroAddress;
    const paymentValue = 0n;
    const paymentReceiver = zeroAddress;

    console.log(`Deploying Safe with owner: ${owners[0]}`);
    console.log(`Expected Safe address: ${expectedAddress}`);
    
    try {
        // Deploy the Safe contract
        const txHash = await walletClient.writeContract({
            address: account.address,
            abi: safeAbiImplementation,
            functionName: "setup",
            args: [
                owners,
                signerThreshold,
                setupAddress,
                setupData,
                fallbackHandler,
                paymentToken,
                paymentValue,
                paymentReceiver,
            ],
            authorizationList: [authorization],
        });
        await publicClient.waitForTransactionReceipt(    {
            hash: txHash
        });
        logTx('Safe deployment', txHash);
        return txHash;
    } catch (error) {
        console.error('❌ Failed to deploy Safe:', error);
        throw error;
    }
}

/**
 * Log a transaction with explorer link
 */
function logTx(description, txHash) {
    console.log(`${description} transaction included: https://odyssey-explorer.ithaca.xyz/tx/${txHash}`);
}
  
async function main() {
    console.log('Starting Pimlico-based Account Abstraction script for iExec');

    // Get environment variables 
    const EOA_PRIVATE_KEY = loadOrGeneratePrivateKey('PRIVATE_KEY', 'PRIVATE_KEY');
    const SAFE_PRIVATE_KEY = loadOrGeneratePrivateKey('SAFE_PRIVATE_KEY', 'SAFE_PRIVATE_KEY');
    const WORK_PK = loadOrGeneratePrivateKey('WORK_PK', 'WORK_PK');
    
    const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;
    if (!PIMLICO_API_KEY) throw new Error('Missing PIMLICO_API_KEY in .env file');
    const pimlicoUrl = `https://api.pimlico.io/v2/${odysseyTestnet.id}/rpc?apikey=${PIMLICO_API_KEY}`

    console.log('Environment variables loaded');

    // Create signers
    const eoaSigner = new ethers.Wallet(EOA_PRIVATE_KEY);
    console.log('EOA Signer address:', eoaSigner.address);

    const safeSigner = new ethers.Wallet(SAFE_PRIVATE_KEY);
    console.log('Safe Signer address:', safeSigner.address);

    const workSigner = new ethers.Wallet(WORK_PK);
    console.log('Worker Signer address:', workSigner.address);

    // Initialize contracts
    const { 
        provider, 
        iexecProxy, 
        iexecBoost,
        AppRegistryABI,
        AppInterfaceABI,
        WorkerpoolRegistryABI,
        WorkerInterfaceABI,
    } = initializeContracts();

    const {smartAccountClient, smartAccountAddress} = await createSmartAccountPimlicoProvider(EOA_PRIVATE_KEY, SAFE_PRIVATE_KEY, pimlicoUrl);

    // Create a provider for ethers contract interactions
    const domain = await getDomain(provider,IEXEC_PROXY_ADDRESS, false);

    // // In your App Developer workflow function:
    const appAddress = "0x9B5351eB2ccC1Eb6ddCaD46f6eA46847ae9C7A4C"
    const appInfo = await createOrVerifyApp({
        iexecProxy,
        provider,
        AppRegistryABI,
        AppInterfaceABI,
        smartAccountAddress,
        smartAccountClient,
        existingAppAddress: appAddress, // null will create a new app
        appName: 'my-Pimlico-app-234',
        appType: 'DOCKER',
        appUri: 'docker.io/hello-world:1.0.0'
    });
    
    console.log(`App setup complete, using app at ${appInfo.appAddress}`); 

    const appOrderResult = await createAndSignAppOrder({
        appAddress,                 // The address of your app
        iexecProxy,                 // Your iExec proxy contract instance
        domain,                     // EIP712 domain for signing
        smartAccountClient,         // Smart account client for signing
        smartAccountAddress,        // Address of the smart account
        price : BigInt(123),
        volume: 1000,               // Order volume
        salt,                       // Salt for the order
    });
    
    // Now you can use the signed order
    const { appOrder, appOrderHash, isSignatureValid } = appOrderResult;
    
    if (isSignatureValid) {
        console.log('App order successfully created and verified!');
        console.log('App Order:', appOrder);
        console.log('App Order Hash:', appOrderHash);
    } else {
        console.error('Failed to create a valid app order. Check the smart account permissions.');
    }

    const workerpoolInfo = await setupWorkerpoolRegistry({
        iexecProxy,
        provider,
        // workerpoolAddressEOA : zeroAddress,0x0C7646596DD583A98885ab5960Eff5BE8eA2D9f9
        workerpoolAddressEOA : "0xCA85fe1eb183c390045D9Cfd470264EDA9256560",
        smartAccountClient,
        smartAccountAddress,
        workSigner,
        WorkerpoolRegistryABI,
        WorkerInterfaceABI,
        createIfMissing: true
    });
    
    // Use the result in subsequent operations
    console.log(`Active workerpool address: ${workerpoolInfo.activeWorkerpoolAddress}`);

    const worker = workSigner;
    console.log(`Worker address: ${worker}`);
    const scheduler = workSigner;

    // Create and sign workerpool order
    const workerpoolOrderInfo = await createAndSignWorkerpoolOrder({
        workerpoolAddress: workerpoolInfo.activeWorkerpoolAddress,
        domain,
        workSigner: worker,
        scheduler: null, // Use workSigner as scheduler if this is null
        provider,
        iexecProxy,
        smartAccountClient,
        IEXEC_PROXY_ADDRESS,
        WorkerInterfaceABI,
        OrderOperationEnum,
        volume: 1000,
        price : BigInt(123),
        salt,
        useSmartAccount: false, // Set to true to use smart account instead of EOA
        preSign: false // Set to true to pre-sign the order on-chain
    });

    console.log(`Workerpool order created with hash: ${workerpoolOrderInfo.workerpoolOrderHash}`);
    console.log(`Signed by: ${workerpoolOrderInfo.signedBy}`);

    // const result = await depositWorkerpoolRLC({
    //     workerpoolAddress: workerpoolInfo.activeWorkerpoolAddress, // Your workerpool address
    //     provider,
    //     iexecProxy,
    //     smartAccountClient: smartAccountClient,
    //     iexecProxyAddress: IEXEC_PROXY_ADDRESS, // iExec proxy address
    //     useSmartAccount: false, // Set to false if using EOA
    //     eoaSigner: workSigner // Only needed if useSmartAccount is false
    // });

    // console.log(`Successfully deposited ${ethers.formatUnits(result.depositedAmount, 9)} RLC to workerpool`);

    // Create and sign request order
    const requestOrderInfo = await createAndSignRequestOrder({
        provider,
        requesterAddress: smartAccountAddress,
        appAddress: appAddress,
        appPrice: appOrder.price,
        workerpoolAddress: workerpoolInfo.activeWorkerpoolAddress,
        workerpoolPrice: workerpoolOrderInfo.workerpoolOrder.workerpoolprice,
        params: 'my-Pimlico-params',
        domain,
        iexecProxy,
        smartAccountClient,
        iexecProxyAddress :IEXEC_PROXY_ADDRESS,
        volume: 1000,
        salt,
        usePreSign: false, // Set to true to pre-sign on-chain instead of off-chain signing
        useEOA: false, // Set to true if you want to use an EOA for signing
        eoaSigner: null // Provide an EOA signer if useEOA is true
    });
    
    console.log(`Request order created with hash: ${requestOrderInfo.requestOrderHash}`);
    console.log(`Signed by: ${requestOrderInfo.signedBy}`);

    // Match the orders
    // const matchResult = await matchOrders({
    //     appOrder: appOrder,
    //     workerpoolOrder: workerpoolOrderInfo.workerpoolOrder,
    //     requestOrder: requestOrderInfo.requestOrder,
    //     iexecBoost, 
    //     iexecProxyAddress: IEXEC_PROXY_ADDRESS,
    //     smartAccountClient,
    //     datasetOrder: null, // Provide a dataset order if needed
    //     useEOA: false, // Set to true if you want to use an EOA for transaction
    //     eoaSigner: null, // Provide an EOA signer if useEOA is true
    //     provider
    // });

    const resultInfo = await pushTaskResult({
        domain,
        taskIndex: 0,
        requestOrder: requestOrderInfo.requestOrder,
        result: 'This is my task result',
        iexecBoost,
        scheduler, // You need a scheduler wallet (typically the workerpool owner)
        worker, // You need a worker wallet to submit the result
        provider
    });
}

async function createOrVerifyApp({
    iexecProxy,
    provider,
    AppRegistryABI,
    AppInterfaceABI,
    smartAccountAddress,
    smartAccountClient,
    existingAppAddress = null,
    appName ,
    appType ,
    appUri
}) {
    try {
        console.log('=== App Setup Process ===');
        
        // Get app registry address and create contract instance
        const appRegistryAddress = await iexecProxy.appregistry();
        console.log(`App registry address: ${appRegistryAddress}`);
        const appRegistry = new ethers.Contract(appRegistryAddress, AppRegistryABI, provider);
        
        // Initialize app address variable
        let appAddress = existingAppAddress;
        let isNewAppCreated = false;
        
        // If no app address provided, create a new one
        if (!appAddress) {
            console.log('No app address provided, creating a new app...');
            isNewAppCreated = true;
        } else {
            // Check if provided app is registered
            const isAppRegistered = await appRegistry.isRegistered(appAddress);
            console.log(`Is app registered: ${isAppRegistered}`);
            
            if (!isAppRegistered) {
                console.log(`App not registered at ${appAddress}, creating a new one...`);
                isNewAppCreated = true;
                appAddress = null; // Clear appAddress to create a new one
            }
        }
        
        let txHash;
        if (isNewAppCreated) {
            // Create transaction data for creating an app
            const createAppData = await appRegistry.createApp.populateTransaction(
                smartAccountAddress, // Using the smart account as the owner
                appName,
                appType,
                ethers.toUtf8Bytes(appUri),
                ethers.ZeroHash,
                ethers.ZeroHash,
            ).then(tx => tx.data);

            // Send user operation via smart account
            const userOperationHash = await smartAccountClient.sendUserOperation({
                calls: [
                    {
                        to:appRegistryAddress,
                        data: createAppData,
                        value: 0n,
                    }
                ],
            });

            const {receipt} = await smartAccountClient.waitForUserOperationReceipt({
                hash: userOperationHash,
            })
            
            // Log transaction details
            logTx("App creation", receipt.transactionHash);
            
            // Extract the app address from the transaction
            appAddress = await extractAssetAddressFromTx(provider, receipt.transactionHash, AppRegistryABI);
            console.log(`New app created with address: ${appAddress}`);
        } else {
            console.log(`Using existing app at ${appAddress}`);
        }
        
        // Verify app ownership
        const appInterface = new ethers.Contract(appAddress, AppInterfaceABI, provider);
        const appOwner = await appInterface.owner();
        console.log(`App owner: ${appOwner}`);
        
        const ownerMatchesSmartAccount = appOwner.toLowerCase() === smartAccountAddress.toLowerCase();
        console.log(`Owner matches smart account: ${ownerMatchesSmartAccount}`);
        
        if (!ownerMatchesSmartAccount) {
            console.warn(`WARNING: App owner (${appOwner}) doesn't match smart account (${smartAccountAddress})`);
        }
        
        // Return relevant information
        return {
            appAddress,
            appOwner,
            ownerMatchesSmartAccount,
            isNewAppCreated,
            txHash: txHash || null
        };
    } catch (error) {
        console.error('Error in createOrVerifyApp:', error);
        throw new Error(`Failed to create or verify app: ${error.message}`);
    }
}

async function setupWorkerpoolRegistry({
    iexecProxy,
    provider,
    workerpoolAddressEOA,
    smartAccountClient,
    smartAccountAddress,
    workSigner,
    WorkerpoolRegistryABI,
    WorkerInterfaceABI,
    createIfMissing = true
}) {
    try {
        console.log('\n=== Workerpool Registry Setup ===');
        
        // Get workerpool registry from iExec proxy
        const workerpoolRegistryAddress = await iexecProxy.workerpoolregistry();
        console.log(`Workerpool registry address: ${workerpoolRegistryAddress}`);
        const workerpoolRegistry = new ethers.Contract(workerpoolRegistryAddress, WorkerpoolRegistryABI, provider);
        
        // Check if the provided workerpool is registered
        console.log(`Checking workerpool ${workerpoolAddressEOA}...`);
        const isWorkerpoolRegistered = await workerpoolRegistry.isRegistered(workerpoolAddressEOA);
        console.log(`Is workerpool registered: ${isWorkerpoolRegistered}`);
        
        let activeWorkerpoolAddress = workerpoolAddressEOA;
        let createdNewWorkerpool = false;
        // If workerpool is not registered and createIfMissing is true, create a new one
        if (!isWorkerpoolRegistered && createIfMissing) {
            console.log('Workerpool not registered. Creating a new workerpool...');
            
            // Decide which approach to use for creating a workerpool
            const useSmartAccount = false; // Set to true to create using smart account instead of EOA
            
            if (useSmartAccount) {
                // Create workerpool using smart account (uncomment if needed)
                console.log('Creating workerpool using smart account...');
                const createWorkerpool = await workerpoolRegistry.createWorkerpool.populateTransaction(
                    smartAccountAddress,
                    'worker-SCA-workerpool',
                ).then(tx => tx.data);
                
                const userOpResult = await smartAccountClient.sendUserOperation({
                    uo: {
                        target: workerpoolRegistryAddress,
                        data: createWorkerpool,
                        value: BigInt(0),
                    },
                });
                
                console.log('User operation hash:', userOpResult.hash);
                const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
                logTx("Workerpool smart account creation", txHash);
                
                // You would need to get the new workerpool address from events
                activeWorkerpoolAddress = await extractAssetAddressFromTx(provider, txHash, WorkerpoolRegistryABI);
                console.log(`New workerpool created with address: ${activeWorkerpoolAddress}`);

            } else {
                // Create workerpool using regular EOA (work signer)
                console.log('Creating workerpool using EOA signer...');
                const workSignerWithProvider = workSigner.connect(provider);
                const workerpoolRegistryWithSigner = workerpoolRegistry.connect(workSignerWithProvider);
                
                const workerpoolName = `worker-eoa-workerpool-${Date.now().toString().substring(8)}`;
                console.log(`Creating workerpool with name: ${workerpoolName}`);
                
                const createTx = await workerpoolRegistryWithSigner.createWorkerpool(
                    workSigner.address,
                    workerpoolName
                );
                
                console.log('Workerpool creation transaction sent:', createTx.hash);
                const receipt = await createTx.wait();
                console.log(`Workerpool creation confirmed in block ${receipt.blockNumber}`);
                logTx("Workerpool EOA creation", createTx.hash);
                activeWorkerpoolAddress = await extractAssetAddressFromTx(provider, createTx.hash, WorkerpoolRegistryABI);
                console.log(`New workerpool created with address: ${activeWorkerpoolAddress}`);
            }
        } else if (!isWorkerpoolRegistered && !createIfMissing) {
            console.error('Workerpool not registered and creation not requested. Please use a registered workerpool.');
            throw new Error('Workerpool not registered');
        } else {
            console.log(`Using existing registered workerpool: ${activeWorkerpoolAddress}`);
        }

        try {
            const workerInterface = new ethers.Contract(workerpoolAddressEOA, WorkerInterfaceABI, provider);
            const workerOwner = await workerInterface.owner();
            console.log(`Worker owner: ${workerOwner}`);
            console.log(`Owner matches EOA: ${workerOwner.toLowerCase() === workSigner.address.toLowerCase()}`);
        } catch (ownerError) {
            console.warn(`Failed to check workerpool owner: ${ownerError.message}`);
        }
        return {
            workerpoolRegistry,
            workerpoolRegistryAddress,
            activeWorkerpoolAddress,
            isWorkerpoolRegistered: isWorkerpoolRegistered || createdNewWorkerpool,
            createdNewWorkerpool
        };
    } catch (error) {
        console.error('Error in setupWorkerpoolRegistry:', error);
        throw error;
    }
}

async function extractAssetAddressFromTx(provider, txHash, AppRegistryABI) {
    try {
        // Get transaction receipt
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            throw new Error(`No receipt found for transaction ${txHash}`);
        }
        
        // Create interface for parsing logs
        const registryInterface = new ethers.Interface(AppRegistryABI);
        
        // Find the Transfer event in the logs
        const transferEventTopic = registryInterface.getEvent("Transfer").topicHash;
        const transferLog = receipt.logs.find(
            log => log.topics[0] === transferEventTopic
        );
        
        if (!transferLog) {
            throw new Error(`No Transfer event found in transaction ${txHash}`);
        }
        
        // Parse the event
        const parsedLog = registryInterface.parseLog({
            topics: transferLog.topics,
            data: transferLog.data
        });
        
        if (!parsedLog || !parsedLog.args) {
            throw new Error(`Failed to parse Transfer event from transaction ${txHash}`);
        }
        
        // Extract tokenId (which is the app ID)
        const tokenId = parsedLog.args.tokenId;
        
        // Convert the token ID to an address format
        // In iExec, the app address is derived from the token ID
        const lowercaseAddress = ethers.zeroPadValue(
            ethers.toBeHex(BigInt(tokenId)), 
            20
        );
        
        // Convert to checksum address
        const checksumAddress = ethers.getAddress(lowercaseAddress);
        
        console.log(`Extracted asset address: ${checksumAddress} from tx: ${txHash}`);
        return checksumAddress;
        
    } catch (error) {
        console.error(`Error extracting app address from tx: ${error.message}`);
        throw error;
    }
}

function generateSalt({ 
    filePath = './salt.txt', 
    useExisting = true 
  } = {}) {
    try {
      // Try to read existing salt if we're allowed to use it
      if (useExisting && existsSync(filePath)) {
        const existingSalt = readFileSync(filePath, 'utf8').trim();
        if (existingSalt && existingSalt.startsWith('0x') && existingSalt.length === 66) {
          console.log(`Using existing salt from ${filePath}: ${existingSalt}`);
          return existingSalt;
        }
      }
      
      // Generate a new salt
      const salt = ethers.id(new Date().toISOString());
      console.log(`Generated new salt: ${salt}`);
      
      // Save it to the file
      writeFileSync(filePath, salt);
      console.log(`Saved salt to ${filePath}`);
      
      return salt;
    } catch (error) {
      console.error(`Error managing salt: ${error.message}`);
      // Fall back to just returning a new salt without saving if there's an error
      return ethers.id(new Date().toISOString());
    }
}

async function createAndSignAppOrder({
    appAddress,
    iexecProxy,
    domain,
    smartAccountClient,
    smartAccountAddress,
    price = BigInt(0), 
    volume = 1000,
    salt,
}) {
    try {
        console.log('=== Creating App Order ===');
        
        if (!appAddress) {
            throw new Error('App address is required to create an app order');
        }
        
        // Create app order
        console.log('Creating app order...');
        let appOrder = createEmptyAppOrder();
        appOrder.app = appAddress;
        appOrder.volume = volume;
        appOrder.salt = salt;
        appOrder.price = price;
        
        console.log(`App order created for app ${appAddress} with volume ${volume}`);
        
        // Sign app order
        console.log('Signing app order with smart account...');
        await signOrderWithPimlicoSmartAccountSigner(domain, appOrder, smartAccountClient);
        const appOrderHash = await hashOrder(domain, appOrder);
        console.log(`App order signed with hash: ${appOrderHash}`);
        
        // Verify signature
        const isAppValidSignature = await iexecProxy.verifySignature(
            smartAccountAddress, 
            appOrderHash,
            appOrder.sign
        );
        
        console.log(`Signature Valid for AppOrder ${smartAccountAddress}: ${isAppValidSignature ? 'YES' : 'NO'}`);
        
        if (!isAppValidSignature) {
            console.error('⚠️ App order signature verification failed. This order may not be valid.');
        }
        
        return {
            appOrder,
            appOrderHash,
            isSignatureValid: isAppValidSignature
        };
    } catch (error) {
        console.error('Error creating and signing app order:', error);
        throw new Error(`Failed to create and sign app order: ${error.message}`);
    }
}

async function createAndSignWorkerpoolOrder({
    workerpoolAddress,
    domain,
    workSigner,
    scheduler,
    provider,
    iexecProxy,
    smartAccountClient,
    iexecProxyAddress,
    WorkerInterfaceABI,
    volume = 1000,
    price = BigInt(0),
    salt,
    useSmartAccount = false,
    preSign = false
}) {
    try {
        console.log('\n=== Creating Workerpool Order ===');
        console.log(`Using workerpool: ${workerpoolAddress}`);
        
        // Create workerpool order
        console.log('Creating workerpool order...');
        let workerpoolOrder = createEmptyWorkerpoolOrder();
        
        workerpoolOrder.workerpool = workerpoolAddress;
        workerpoolOrder.volume = volume;
        workerpoolOrder.salt = salt;
        workerpoolOrder.workerpoolprice = price;
        
        // Get workerpool owner for verification
        const workerInterface= new ethers.Contract(workerpoolAddress, WorkerInterfaceABI, provider)
        const workerpoolOwner = await workerInterface.owner();
        console.log(`Workerpool owner: ${workerpoolOwner}`);
        
        // Sign workerpool order with appropriate signer
        const signingAddress = useSmartAccount ? smartAccountClient.account.address : workSigner.address;
        console.log(`Signing workerpool order with address: ${signingAddress}`);
        if (preSign) {
            console.log('Pre-signing workerpool order...');
            
            if (useSmartAccount) {
                // Use smart account for pre-signing
                console.log('Pre-signing with smart account...');
                const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
                const manageOrder = (await iexecProxy.manageWorkerpoolOrder.populateTransaction(orderOperation))
                    .data;
                
                const userOpResult = await smartAccountClient.sendUserOperation({
                    uo: {
                        target: iexecProxyAddress,
                        data: manageOrder,
                        value: BigInt(0),
                    },
                });
                
                console.log('User operation hash:', userOpResult.hash);
                const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
                logTx("Workerpool order pre-sign with smart account", txHash);
                
                // Verify pre-signature
                try {
                    const isPresigned = await iexecProxy.viewPresigned(workerpoolOrderHash);
                    console.log(`Pre-signature verification: ${isPresigned === smartAccountClient.account.address ? 'SUCCESS' : 'FAILED'}`);
                } catch (e) {
                    console.warn(`Failed to verify pre-signature: ${e.message}`);
                }
            } else {
                // Use EOA for pre-signing
                console.log('Pre-signing with EOA...');
                const workSignerWithProvider = workSigner.connect(provider);
                const iexecProxyWithWorkerSigner = iexecProxy.connect(workSignerWithProvider);
                const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
                
                const presignTx = await iexecProxyWithWorkerSigner.manageWorkerpoolOrder(orderOperation);
                console.log('Pre-sign transaction sent:', presignTx.hash);
                const receipt = await presignTx.wait();
                console.log(`Pre-sign confirmed in block ${receipt.blockNumber}`);
                logTx("Workerpool order pre-sign with EOA", presignTx.hash);
                
                // Verify pre-signature
                try {
                    const isPresigned = await iexecProxy.viewPresigned(workerpoolOrderHash);
                    console.log(`Pre-signature verification: ${isPresigned === workSigner.address ? 'SUCCESS' : 'FAILED'}`);
                } catch (e) {
                    console.warn(`Failed to verify pre-signature: ${e.message}`);
                }
            }
        } else {
            if (useSmartAccount) {
                // This will be handled in the pre-sign section if useSmartAccount is true
                console.log('Using smart account for workerpool order signature');
            } else {
                // Sign with EOA (workSigner)
                console.log('Signing workerpool order with worker signer (EOA)...');
                await signOrder(domain, workerpoolOrder, scheduler || workSigner);
                
                // Verify signature
                const isValidSignature = await iexecProxy.verifySignature(
                    workerpoolOwner,
                    await hashOrder(domain, workerpoolOrder),
                    workerpoolOrder.sign
                );
                console.log(`Signature valid for ${workerpoolOwner}: ${isValidSignature ? 'YES' : 'NO'}`);
                
                if (!isValidSignature) {
                    console.warn('Signature validation failed! The order might not be accepted on-chain.');
                }
            }
        }
        // Hash the order
        const workerpoolOrderHash = await hashOrder(domain, workerpoolOrder);
        console.log(`Workerpool order hash: ${workerpoolOrderHash}`);

        
        return {
            workerpoolOrder,
            workerpoolOrderHash,
            workerpoolOwner,
            signedBy: useSmartAccount ? smartAccountClient.account.address : workSigner.address,
            isPreSigned: preSign
        };
    } catch (error) {
        console.error('Error in createWorkerpoolOrder:', error);
        throw error;
    }
}

async function createAndSignRequestOrder({
    provider,
    requesterAddress,
    appAddress,
    appPrice,
    workerpoolAddress,
    workerpoolPrice,
    params,
    domain,
    iexecProxy,
    smartAccountClient,
    iexecProxyAddress,
    volume = 1000,
    salt,
    usePreSign = false,
    useEOA = false,
    eoaSigner = null
}) {
    try {
        console.log('\n=== Creating Request Order ===');
        console.log(`Requester: ${requesterAddress}`);
        console.log(`App: ${appAddress}`);
        console.log(`Workerpool: ${workerpoolAddress}`);
        
        console.log('Creating request order...');
        let requestOrder = createEmptyRequestOrder();

        console.log('Checking iExec account balance...');
        const accountInfo = await iexecProxy.viewAccount(requesterAddress);
        
        // Extract the available balance (total balance minus frozen)
        let currentBalance = BigInt(accountInfo.stake.toString());
        console.log(`Account balance: ${currentBalance} RLC`);
        
        let minimumBalance = BigInt(0);
        minimumBalance += appPrice;
        minimumBalance += workerpoolPrice;
        minimumBalance = minimumBalance * BigInt(volume);
        const depositAmount = minimumBalance
        // if (currentBalance < minimumBalance) {
        //     console.log(`Balance is below minimum. Need to deposit at least ${ethers.formatUnits(minimumBalance - currentBalance, 9)} RLC`);
            
        //     // Get the RLC token address
        //     let rlcTokenAddress = await iexecProxy.token();
        //     console.log(`RLC token address: ${rlcTokenAddress}`);
            
        //     // Create RLC contract instance
        //     const rlcContract = new ethers.Contract(
        //         rlcTokenAddress,
        //         loadAbi('IexecInterfaceToken'),
        //         provider
        //     );
        //     // Check RLC token balance
        //     const rlcBalance = await rlcContract.balanceOf(requesterAddress);
        //     console.log(`RLC token balance: ${ethers.formatUnits(rlcBalance, 9)} RLC`);
            
        //     if (rlcBalance < depositAmount) {
        //         throw new Error(`Insufficient RLC balance. You need at least ${ethers.formatUnits(depositAmount, 9)} RLC to deposit, but only have ${ethers.fformatUnits(rlcBalance, 9)} RLC.`);
        //     }
            
        //     // Deposit RLC tokens to PoCo
        //     console.log(`Depositing ${ethers.formatUnits(depositAmount, 9)} RLC to iExec account...`);
            
        //     if (useEOA && eoaSigner) {
        //         // Deposit using EOA
        //         const tx = await rlcContract.approveAndCall(
        //             iexecProxyAddress,
        //             depositAmount,
        //             '0x'
        //         );
        //         console.log(`Deposit transaction sent: ${tx.hash}`);
        //         await tx.wait();
        //         console.log('Deposit transaction confirmed!');
                
        //     } else {
        //         // Deposit using smart account
        //         const approveAndCallData = await rlcContract.approveAndCall.populateTransaction(
        //             iexecProxyAddress, depositAmount, '0x',
        //         ).then(tx => tx.data);
                
        //         console.log('Sending user operation for RLC deposit...');
        //         const userOpResult = await smartAccountClient.sendUserOperation({
        //             calls: [
        //                 {
        //                     to:rlcTokenAddress,
        //                     data: approveAndCallData,
        //                     value: 0n,
        //                 }
        //             ],
        //         });
                
        //         console.log('Deposit user operation hash:', userOpResult.hash);
        //         const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
        //         logTx("RLC deposit", txHash);
        //     }
            
        //     // Check updated balance
        //     const updatedBalance = await iexecProxy.viewAccount(requesterAddress);
        //     currentBalance = BigInt(updatedBalance.stake.toString());
        //     console.log(`Updated iExec account balance: ${ethers.formatUnits(currentBalance.toString(), 9)} RLC`);
            
        //     if (BigInt(currentBalance.toString()) < minimumBalance) {
        //         console.warn(`Warning: Balance after deposit (${ethers.formatUnits(currentBalance.toString(), 9)} RLC) is still below minimum required (${ethers.formatUnits(minimumBalance, 9)} RLC).`);
        //     } else {
        //         console.log(`✅ Sufficient balance confirmed for task execution.`);
        //     }
        // } else {
        //     console.log(`✅ Sufficient balance already available for task execution.`);
        // }
        
        // Create request order
        
        requestOrder.requester = requesterAddress;
        requestOrder.app = appAddress;
        requestOrder.workerpool = workerpoolAddress;
        requestOrder.params = params;
        requestOrder.salt = salt;
        requestOrder.volume = volume;
        
        // Sign the request order
        let requestOrderHash;
        
        if (usePreSign) {
            // Pre-sign the order on-chain (typically used with smart accounts)
            console.log('Pre-signing request order on-chain...');
            
            const requestOrderOperation = createOrderOperation(requestOrder, OrderOperationEnum.SIGN);
            const manageRequestOrderData = await iexecProxy.manageRequestOrder.populateTransaction(
                requestOrderOperation,
            ).then(tx => tx.data);

            console.log('Sending user operation to pre-sign request order...');
            const userOpResult = await smartAccountClient.sendUserOperation({
                calls: [
                    {
                        to: iexecProxyAddress,
                    data: manageRequestOrderData,
                    value: BigInt(0),
                }
            ],
            });
            
            console.log('User operation hash:', userOpResult.hash);
            const txHash = await smartAccountClient.waitForUserOperationTransaction(userOpResult);
            logTx("Request order pre-sign", txHash);
            
            // Get the order hash
            requestOrderHash = await hashOrder(domain, requestOrder);
            
            // Verify pre-signature
            try {
                const isPresigned = await iexecProxy.viewPresigned(requestOrderHash);
                console.log(`Pre-signature verification: ${isPresigned === requesterAddress ? 'SUCCESS' : 'FAILED'}`);
            } catch (e) {
                console.warn(`Failed to verify pre-signature: ${e.message}`);
            }
            
        } else if (useEOA && eoaSigner) {
            // Sign with EOA
            console.log('Signing request order with EOA...');
            await signOrder(domain, requestOrder, eoaSigner);
            requestOrderHash = await hashOrder(domain, requestOrder);
            console.log(`Request order signed with hash: ${requestOrderHash}`);
            
        } else {
            // Sign with smart account off-chain
            console.log('Signing request order with smart account...');
            await signOrderWithPimlicoSmartAccountSigner(domain, requestOrder, smartAccountClient);
            requestOrderHash = await hashOrder(domain, requestOrder);
            console.log(`Request order signed with hash: ${requestOrderHash}`);
        }
        
        // Verify the signature
        try {
            const isValidSignature = await iexecProxy.verifySignature(
                requesterAddress, 
                requestOrderHash,
                requestOrder.sign
            );
            console.log(`Signature valid for ${requesterAddress}: ${isValidSignature ? 'YES' : 'NO'}`);
            
            if (!isValidSignature) {
                console.warn('Signature validation failed! The order might not be accepted on-chain.');
            }
        } catch (verifyError) {
            console.warn(`Error verifying signature: ${verifyError.message}`);
            // If using pre-sign, this might fail because we don't have an actual signature
            if (usePreSign) {
                console.log('Signature verification skipped for pre-signed order.');
            }
        }
        
        return {
            requestOrder,
            requestOrderHash,
            requesterAddress,
            signedBy: useEOA ? eoaSigner.address : requesterAddress,
            isPreSigned: usePreSign
        };
    } catch (error) {
        console.error('Error in createRequestOrder:', error);
        throw error;
    }
}

async function depositWorkerpoolRLC({
    workerpoolAddress,
    provider,
    iexecProxy,
    smartAccountClient,
    iexecProxyAddress,
    useSmartAccount = false,
    eoaSigner = null
}) {
    try {
        console.log('\n=== Depositing RLC to Workerpool ===');
        console.log(`Workerpool: ${workerpoolAddress}`);
        
        // Get the RLC token address
        const rlcTokenAddress = await iexecProxy.token();
        console.log(`RLC token address: ${rlcTokenAddress}`);
        
        // Create RLC contract instance for reading balance
        const rlcContract = new ethers.Contract(
            rlcTokenAddress,
            loadAbi('IexecInterfaceToken'),
            provider
        );
        
        // Check RLC token balance
        const rlcBalance = await rlcContract.balanceOf(eoaSigner.address);
        const decimals = await rlcContract.decimals();
        console.log(`RLC token balance: ${ethers.formatUnits(rlcBalance, decimals)} RLC`);
        
        if (rlcBalance <= 0) {
            throw new Error(`No RLC tokens available to deposit.`);
        }
         // Using EOA signer
         if (!eoaSigner) {
            throw new Error("EOA signer is required when useSmartAccount is false");
        }
        
        // Connect contracts to EOA signer
        const workSignerWithProvider = eoaSigner.connect(provider);
        const rlcWithSigner = rlcContract.connect(workSignerWithProvider);


        const tx = await rlcWithSigner.approveAndCall(
            iexecProxyAddress,
            rlcBalance,
            '0x'
        );
        await tx.wait();
        logTx("RLC deposit to workerpool", tx.hash);
        
        // Check workerpool balance after deposit
        try {
            console.log('Checking updated workerpool balance...');
            // For workerpools, we need to check their stake in the escrow
            const workerpoolAccount = await iexecProxy.viewAccount(eoaSigner.address);
            const workerpoolBalance = BigInt(workerpoolAccount.stake.toString());
            const workerpoolLocked = BigInt(workerpoolAccount.locked.toString());
            
            console.log(`Workerpool balance: ${ethers.formatUnits(workerpoolBalance, decimals)} RLC`);
            console.log(`Workerpool locked: ${ethers.formatUnits(workerpoolLocked, decimals)} RLC`);
            console.log(`Workerpool available: ${ethers.formatUnits(workerpoolBalance - workerpoolLocked, decimals)} RLC`);
            
            // Also check remaining wallet balance
            const remainingBalance = await rlcContract.balanceOf(eoaSigner.address);
            console.log(`Remaining wallet balance: ${ethers.formatUnits(remainingBalance, decimals)} RLC`);
            
            return {
                success: true,
                depositedAmount: depositAmount,
                newWorkerpoolBalance: workerpoolBalance,
                remainingWalletBalance: remainingBalance
            };
        } catch (e) {
            console.warn(`Could not verify workerpool balance: ${e.message}`);
            return {
                success: true,
                depositedAmount: rlcBalance
            };
        }
    } catch (error) {
        console.error('Error in depositWorkerpoolRLC:', error);
        throw error;
    }
}


async function matchOrders({
    appOrder,
    workerpoolOrder,
    requestOrder,
    iexecBoost,
    iexecProxyAddress,
    smartAccountClient,
    datasetOrder = null,
    useEOA = false,
    eoaSigner = null,
    provider
}) {
    try {
        console.log('\n=== Matching Orders ===');
        
        // Use empty dataset order if none provided
        const effectiveDatasetOrder = datasetOrder || createEmptyDatasetOrder();
        
        console.log(`App: ${appOrder.app}`);
        console.log(`Workerpool: ${workerpoolOrder.workerpool}`);
        console.log(`Requester: ${requestOrder.requester}`);
        
        if (datasetOrder) {
            console.log(`Dataset: ${datasetOrder.dataset}`);
        } else {
            console.log('No dataset used');
        }
        
        let txHash;
        
        if (useEOA && eoaSigner) {
            console.log('Matching orders using EOA signer...');
            
            // Connect signer to provider
            const eoaSignerWithProvider = eoaSigner.connect(provider);
            
            // Connect contracts with signer
            const iexecBoostWithSigner = iexecBoost.connect(eoaSignerWithProvider);
            
            // Match orders
            const matchTx = await iexecBoostWithSigner.matchOrdersBoost(
                appOrder,
                effectiveDatasetOrder,
                workerpoolOrder,
                requestOrder
            );
            
            console.log('Match transaction sent:', matchTx.hash);
            txHash = matchTx.hash;
            
            const receipt = await matchTx.wait();
            console.log(`Match confirmed in block ${receipt.blockNumber}`);
            logTx("Match orders with EOA", txHash);
            
        } else {
            console.log('Matching orders using smart account...');
            
            // Prepare transaction data for user operation
            const matchOrdersData = await iexecBoost.matchOrdersBoost.populateTransaction(
                appOrder,
                effectiveDatasetOrder,
                workerpoolOrder,
                requestOrder
            ).then(tx => tx.data);
            
            // Send user operation
            console.log('Sending user operation to match orders...');
            const matchUserOpResult = await smartAccountClient.sendUserOperation({
                calls: [
                    {
                        to:iexecProxyAddress,
                        data: matchOrdersData,
                        value: 0n,
                    }
                ],
            });
            const {receipt} = await smartAccountClient.waitForUserOperationReceipt({
                hash: matchUserOpResult,
            })
            logTx("Match orders with smart account", receipt.transactionHash);
        }
    } catch (error) {
        console.error('Error in matchOrders:', error);
        throw error;
    }
}

async function pushTaskResult({
    domain,
    taskIndex = 0,
    requestOrder,
    result,
    iexecBoost,
    scheduler,
    worker,
    provider,
    enclaveAddress = zeroAddress,
    resultsCallback = '0x'
}) {
    try {
        console.log('\n=== Pushing Task Results ===');
        const dealId = getDealId(domain, requestOrder, taskIndex);
        console.log(`Deal ID: ${dealId}`);
        console.log(`Task Index: ${taskIndex}`);
        
        // Get the task ID
        const taskId = getTaskId(dealId, taskIndex);
        console.log(`Task ID: ${taskId}`);
        
        // Fetch deal details for validation and information
        console.log('Fetching deal details...');
        const dealBoost = await iexecBoost.viewDealBoost(dealId);
        console.log('Deal details:', {
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
        
        // Prepare result and calculate digest
        console.log(`Building result: "${result}"`);
        const { results, resultDigest } = buildUtf8ResultAndDigest(result);
        console.log(`Result digest: ${resultDigest}`);
        
        // Create and sign authorization message from scheduler
        console.log('Creating scheduler authorization...');
        const schedulerMessage = buildContributionAuthorizationMessage(
            worker.address,
            taskId,
            enclaveAddress
        );
        
        console.log('Scheduler address:', scheduler.address);
        console.log('Worker address:', worker.address);
        console.log('Authorization message:', schedulerMessage);
        
        // Sign the message with scheduler
        const schedulerSignature = await signMessage(scheduler, schedulerMessage);
        console.log(`Scheduler signature: ${schedulerSignature}`);
        
        // Optional TEE enclave signature (empty in this case)
        const enclaveSignature = '0x'; // Not using enclave
        
        // Connect worker signer to provider
        console.log('Preparing worker signer...');
        const workerWithProvider = worker.connect(provider);
        
        // Push the result using the worker
        console.log('Pushing result to chain...');
        const pushResultTx = await iexecBoost.connect(workerWithProvider).pushResultBoost(
            dealId,
            taskIndex,
            results,
            resultsCallback,
            schedulerSignature,
            enclaveAddress,
            enclaveSignature
        );
        
        console.log('Transaction sent:', pushResultTx.hash);
        
        // Wait for transaction confirmation
        const receipt = await pushResultTx.wait();
        console.log(`Result push confirmed in block ${receipt.blockNumber}`);
        logTx("Push result", pushResultTx.hash);
    } catch (error) {
        console.error('Error in pushTaskResult:', error);
        throw error;
    }
}

// Run the main function
console.log('Starting Account Abstraction for iExec...');
try {
    await main();
} catch (err) {
    console.error("Error in execution:", err);
} finally {
    console.log("\n--- SCRIPT COMPLETED ---");
}