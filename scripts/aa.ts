// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { writeFileSync } from 'fs';
import { ethers } from 'hardhat';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { Hex, createPublicClient, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import {
    AppInterface__factory,
    AppRegistryInterface__factory,
    IexecInterfaceToken__factory,
    IexecPocoBoostDelegate__factory,
    WorkerpoolRegistryInterface__factory,
} from '../typechain';
import { OrderOperationEnum } from '../utils/constants';
import {
    createEmptyAppOrder,
    createEmptyRequestOrder,
    createEmptyWorkerpoolOrder,
    createOrderOperation,
    hashOrder,
} from '../utils/createOrders';

// PRIVATE_KEY=<> PIMLICO_API_KEY=<key> npx hardhat run scripts/aa.ts

(async () => {
    console.log('Hello world!');

    const apiKey = process.env.PIMLICO_API_KEY;
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const privateKey =
        (process.env.PRIVATE_KEY as Hex) ??
        (() => {
            const pk = generatePrivateKey();
            writeFileSync('.env', `PRIVATE_KEY=${pk}`);
            return pk;
        })();

    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http('https://arbitrum-sepolia.gateway.tenderly.co'),
    });

    const pimlicoUrl = `https://api.pimlico.io/v2/421614/rpc?apikey=${apiKey}`;

    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
        },
    });

    const account = await toSafeSmartAccount({
        client: publicClient,
        owners: [privateKeyToAccount(privateKey)],
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
        }, // global entrypoint
        version: '1.4.1',
    });

    console.log(`Smart account address: https://sepolia.arbiscan.io/address/${account.address}`);
    // Smart account address: https://sepolia.arbiscan.io/address/0x50063560EaBadad9f7FF5350851BB3223844B828

    const smartAccountClient = createSmartAccountClient({
        account,
        chain: arbitrumSepolia,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                return (await pimlicoClient.getUserOperationGasPrice()).fast;
            },
        },
    });

    // const txHash = await smartAccountClient.sendTransaction({
    //     to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    //     value: 0n,
    //     data: "0x1234",
    // })

    // console.log(`User operation included: https://sepolia.arbiscan.io/tx/${txHash}`)
    // User operation included: https://sepolia.arbiscan.io/tx/0xa01e287094718a4911e1d447c2b2feeef45ccdaa8ff293ed3c6dc335a50ae2d4
    // User operation included: https://sepolia.arbiscan.io/tx/0x9c7c08fc80e2577a58711f24322bc3d1fc52e8ff77c0eb6c79951a16683b6af0

    const iexecProxyAddress = '0x61b18b60a83bf11db697c4a7aafb8d3d947ac81c';
    const iexecProxy = IexecInterfaceToken__factory.connect(iexecProxyAddress, ethers.provider);
    const domain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: iexecProxyAddress,
    };

    const appRegistryAddress = await iexecProxy.appregistry();
    console.log(appRegistryAddress);
    const appRegistry = AppRegistryInterface__factory.connect(appRegistryAddress, ethers.provider);
    /*
    const createAppData = (await appRegistry.createApp.populateTransaction(
        account.address,
        'myy-app',
        'DOCKER',
        ethers.toUtf8Bytes('docker.io/hello-world:1.0.0'),
        ethers.ZeroHash,
        ethers.ZeroHash,
    )).data
    console.log(createAppData)
    const txHash = await smartAccountClient.sendTransaction({
        to: appRegistryAddress as Address,
        value: 0n,
        data: createAppData as `0x${string}`,
    })
    logTx(txHash);
    // https://sepolia.arbiscan.io/tx/0x06a753e061d0f47efae79edbadae94721f2098c043fa3a9462c1b68c5838e884
    // app: https://sepolia.arbiscan.io/address/0x789bc2cdf156b455a7f9d6267f0ae3f3b92059d4
    */
    const appAddress = '0x789bc2cdf156b455a7f9d6267f0ae3f3b92059d4';
    console.log(await appRegistry.isRegistered(appAddress));
    const appOwner = await AppInterface__factory.connect(appAddress, ethers.provider).owner();
    console.log(appOwner);
    console.log(appOwner == account.address);
    let appOrder = createEmptyAppOrder();
    appOrder.app = appAddress;
    appOrder.volume = 10;
    console.log(appOrder);
    const appOrderOperation = createOrderOperation(appOrder, OrderOperationEnum.SIGN);
    console.log(appOrderOperation);
    const manageAppOrder = (await iexecProxy.manageAppOrder.populateTransaction(appOrderOperation))
        .data;
    /*
    const txHash = await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: manageAppOrder as `0x${string}`,
    })
    logTx(txHash);
    */
    // User operation included: https://sepolia.arbiscan.io/tx/0xeb3f5c6204b4fcdb3678d24268eb6f0bea8c4294704533fa7d983f2ad2cd4643
    // See SignedAppOrder (bytes32 appHash) event:
    // https://sepolia.arbiscan.io/tx/0x601bbf4929250692674212809fd12993cb1e6c19af8c9d83da19fa23d2240c43#eventlog
    const appOrderHash = hashOrder(
        {
            name: 'iExecODB',
            version: '5.0.0',
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: iexecProxyAddress,
        },
        appOrder,
    );
    console.log(appOrderHash);
    // BB0703C8E313C8E4A136CA87618A84717AB338819A8F8001C41135976D836347
    console.log((await iexecProxy.viewPresigned(appOrderHash)) == account.address);

    const workerpoolRegistryAddress = await iexecProxy.workerpoolregistry();
    console.log(workerpoolRegistryAddress);
    const workerpoolRegistry = WorkerpoolRegistryInterface__factory.connect(
        workerpoolRegistryAddress,
        ethers.provider,
    );
    const createWorkerpool = (
        await workerpoolRegistry.createWorkerpool.populateTransaction(
            account.address,
            'my-workerpool',
        )
    ).data;
    console.log(createWorkerpool);
    /*
    const txHash = await smartAccountClient.sendTransaction({
        to: workerpoolRegistryAddress as Address,
        value: 0n,
        data: createWorkerpool as `0x${string}`,
    })
    logTx(txHash);
    */
    // User operation included: https://sepolia.arbiscan.io/tx/0xda863ab32013114d4a7c323e47281b4acf37f4c294519a253c92e1c0003d5b2f
    // workerpool: https://sepolia.arbiscan.io/address/0xddfd7b26ff3db17e58e0613bc895939a35c1fc76
    const workerpoolAddress = '0xddfd7b26ff3db17e58e0613bc895939a35c1fc76';
    console.log(await workerpoolRegistry.isRegistered(workerpoolAddress));
    const owner = await AppInterface__factory.connect(workerpoolAddress, ethers.provider).owner();
    console.log(owner);
    console.log(owner == account.address);
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    workerpoolOrder.workerpool = workerpoolAddress;
    workerpoolOrder.volume = 10;
    console.log(workerpoolOrder);
    const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
    console.log(orderOperation);
    const manageOrder = (await iexecProxy.manageWorkerpoolOrder.populateTransaction(orderOperation))
        .data;
    /*
    const txHash = await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: manageOrder as `0x${string}`,
    })
    logTx(txHash);
    // User operation included: https://sepolia.arbiscan.io/tx/0x12f6f9e0209ef50171d712b3a087e453a095d254c06a645dc4ab9432e1c08607
    */
    const workerpoolOrderHash = hashOrder(domain, workerpoolOrder);
    console.log(workerpoolOrderHash);
    // order hash: 0xe7b688d606f6a22a1c1ccde433965a5640538d5556f465f2ec13e9ba6cae736a
    console.log((await iexecProxy.viewPresigned(workerpoolOrderHash)) == account.address);

    let requestOrder = createEmptyRequestOrder();
    requestOrder.requester = account.address;
    requestOrder.app = appAddress;
    requestOrder.workerpool = workerpoolAddress;
    requestOrder.params = 'my-params';
    requestOrder.salt = ethers.id('1');
    const requestOrderOperation = createOrderOperation(requestOrder, OrderOperationEnum.SIGN);
    console.log(requestOrderOperation);
    /*
    logTx(await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: (await iexecProxy.manageRequestOrder.populateTransaction(requestOrderOperation)).data as `0x${string}`,
    }));
    // User operation included: https://sepolia.arbiscan.io/tx/0x6cd187a55e2eda8ab1db71daff1195261ac298b7218ec238616a0214899c9718
    */
    const requesterOrderHash = hashOrder(domain, requestOrder);
    console.log(requesterOrderHash);
    console.log((await iexecProxy.viewPresigned(requesterOrderHash)) == account.address);

    const iexecBoost = IexecPocoBoostDelegate__factory.connect(iexecProxyAddress, ethers.provider);
    /*
    const matchOrdersBoost = (await iexecBoost.matchOrdersBoost.populateTransaction(appOrder, 
        createEmptyDatasetOrder(), 
        workerpoolOrder, 
        requestOrder)).data
    
    const txHash = await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: matchOrdersBoost as `0x${string}`,
    })
    logTx(txHash);
    */
    // User operation included: https://sepolia.arbiscan.io/tx/0x18216138d13fc97b682c70dd1e1b0922c8faf7f464a9ecef74f2889353dc7217
    // See OrdersMatched (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume)
    // Deal id: 2D645413966E5CF3E37A8B168A7B5AD19F82EA01274CDE5D39530E85CFDE7036
    const dealId = '0x2D645413966E5CF3E37A8B168A7B5AD19F82EA01274CDE5D39530E85CFDE7036';
})().catch((error) => console.log(error));

function logTx(txHash: string) {
    console.log(`User operation included: https://sepolia.arbiscan.io/tx/${txHash}`);
}
