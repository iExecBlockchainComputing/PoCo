// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import ProtocolKit, { hashSafeMessage, SigningMethod } from '@safe-global/protocol-kit';
import { EIP712TypedData } from '@safe-global/types-kit';
import { writeFileSync } from 'fs';
import { ethers } from 'hardhat';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { Address, createPublicClient, Hex, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { Safe__factory } from '../safe-smart-account/typechain-types';
import {
    AppInterface__factory,
    AppRegistryInterface__factory,
    IexecInterfaceToken__factory,
    IexecLibOrders_v5,
    IexecPocoBoostDelegate__factory,
    WorkerpoolRegistryInterface__factory,
} from '../typechain';
import {
    createEmptyAppOrder,
    createEmptyDatasetOrder,
    createEmptyRequestOrder,
    createEmptyWorkerpoolOrder,
    getEIP712TypedDataOrder as getEip712TypedDataOrder,
    hashOrder,
    signOrder,
} from '../utils/createOrders';
import {
    buildContributionAuthorizationMessage,
    buildUtf8ResultAndDigest,
    getDealId,
    getTaskId,
    signMessage,
} from '../utils/poco-tools';

// WORK_PK=<> PRIVATE_KEY=<> PIMLICO_API_KEY=<key> npx hardhat run scripts/aa.ts

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

    const url = 'https://arbitrum-sepolia.gateway.tenderly.co';

    const publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(url),
    });

    const pimlicoUrl = `https://api.pimlico.io/v2/421614/rpc?apikey=${apiKey}`;

    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
        },
    });

    const eoaSigner = new ethers.Wallet(privateKey);
    console.log('************');
    console.log(eoaSigner.address);
    // 0x1CD542C9B91cfd2F909A59B241583bA5Ea3595F8

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

    const safeAccount = Safe__factory.connect(account.address, ethers.provider);
    // const safeAccount2 = ERC1271__factory.connect(account.address, ethers.provider)

    console.log('domain:');
    console.log(await safeAccount.domainSeparator());

    const protocolKit = await ProtocolKit.init({
        provider: url,
        safeAddress: await safeAccount.getAddress(),
        signer: privateKey,
    });
    const rawMessage: string | EIP712TypedData = 'Example message';
    const messageHash = hashSafeMessage(rawMessage);
    const signature = await protocolKit.signMessage(protocolKit.createMessage(rawMessage));
    console.log(signature.getSignature(eoaSigner.address)?.data);
    console.log(
        await protocolKit.isValidSignature(
            messageHash,
            signature.getSignature(eoaSigner.address)?.data,
        ),
    );
    console.log(await protocolKit.getOwners());
    console.log(await protocolKit.getThreshold());

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
    const salt = ethers.id(new Date().toISOString());
    let appOrder = createEmptyAppOrder();
    appOrder.app = appAddress;
    appOrder.volume = 10;
    appOrder.salt = salt;
    await signOrderWithSafeOwnerSigner(domain, appOrder, protocolKit);

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
    /*
    console.log(createWorkerpool);
    const txHash = await smartAccountClient.sendTransaction({
        to: workerpoolRegistryAddress as Address,
        value: 0n,
        data: createWorkerpool as `0x${string}`,
    })
    logTx(txHash);
    */
    // User operation included: https://sepolia.arbiscan.io/tx/0xda863ab32013114d4a7c323e47281b4acf37f4c294519a253c92e1c0003d5b2f
    // workerpool: https://sepolia.arbiscan.io/address/0xddfd7b26ff3db17e58e0613bc895939a35c1fc76
    const workerpoolFromScaAddress = '0xddfd7b26ff3db17e58e0613bc895939a35c1fc76'; // owner is 0x500 SCA
    const workerpoolFromEoaAddress = '0x97A729c1C33AF1c84CBD9dB95ACd487eBf83aF0a'; // owner is 0x30e EOA
    const workerpoolAddress = workerpoolFromEoaAddress; // owner is 0x30e EOA

    const eoaWorkSigner = new ethers.Wallet(process.env.WORK_PK!, ethers.provider);

    const worker = eoaWorkSigner;
    const enclave = { address: account.address };
    const scheduler = eoaWorkSigner;

    console.log(await workerpoolRegistry.isRegistered(workerpoolAddress));
    const owner = await AppInterface__factory.connect(workerpoolAddress, ethers.provider).owner();
    console.log(owner);
    let workerpoolOrder = createEmptyWorkerpoolOrder();
    workerpoolOrder.workerpool = workerpoolAddress;
    workerpoolOrder.volume = 10;
    workerpoolOrder.salt = salt;
    if (workerpoolAddress == workerpoolFromScaAddress) {
        // console.log(owner == account.address);
        // await signOrderWithSafeOwnerSigner(domain, workerpoolOrder, protocolKit);
    } else {
        await signOrder(domain, workerpoolOrder, scheduler);
    }

    // console.log(workerpoolOrder);
    /*
    const orderOperation = createOrderOperation(workerpoolOrder, OrderOperationEnum.SIGN);
    console.log(orderOperation);
    const manageOrder = (await iexecProxy.manageWorkerpoolOrder.populateTransaction(orderOperation))
        .data;
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
    // console.log((await iexecProxy.viewPresigned(workerpoolOrderHash)) == account.address);

    let requestOrder = createEmptyRequestOrder();
    requestOrder.requester = account.address;
    requestOrder.app = appAddress;
    requestOrder.workerpool = workerpoolAddress;
    requestOrder.params = 'my-params';
    requestOrder.salt = salt;
    await signOrderWithSafeOwnerSigner(domain, requestOrder, protocolKit);

    /*
    const requestOrderOperation = createOrderOperation(requestOrder, OrderOperationEnum.SIGN);
    console.log(requestOrderOperation);
    logTx(await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: (await iexecProxy.manageRequestOrder.populateTransaction(requestOrderOperation)).data as `0x${string}`,
    }));
    // User operation included: https://sepolia.arbiscan.io/tx/0x6cd187a55e2eda8ab1db71daff1195261ac298b7218ec238616a0214899c9718
    */
    const requesterOrderHash = hashOrder(domain, requestOrder);
    console.log(requesterOrderHash);
    // console.log((await iexecProxy.viewPresigned(requesterOrderHash)) == account.address);

    const iexecBoost = IexecPocoBoostDelegate__factory.connect(iexecProxyAddress, ethers.provider);

    const matchOrdersBoost = (
        await iexecBoost.matchOrdersBoost.populateTransaction(
            appOrder,
            createEmptyDatasetOrder(),
            workerpoolOrder,
            requestOrder,
        )
    ).data;

    const matchTxHash = await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: matchOrdersBoost as `0x${string}`,
    });
    logTx(matchTxHash);

    // User operation included: https://sepolia.arbiscan.io/tx/0x18216138d13fc97b682c70dd1e1b0922c8faf7f464a9ecef74f2889353dc7217
    // See OrdersMatched (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume)
    // Deal id: 2D645413966E5CF3E37A8B168A7B5AD19F82EA01274CDE5D39530E85CFDE7036
    // const dealId = '0x2D645413966E5CF3E37A8B168A7B5AD19F82EA01274CDE5D39530E85CFDE7036';

    // Request order signed by EOA of smart account
    //     // User operation included: https://sepolia.arbiscan.io/tx/0xf79696235160eb078e03489df68327cbb3e1d68139cad87a2366d1f696ef4194
    const taskIndex = 0n;
    const dealId = getDealId(domain, requestOrder, taskIndex);
    const taskId = getTaskId(dealId, taskIndex);
    console.log(`dealId: ${dealId}`);
    console.log(`taskId: ${taskId}`);

    console.log(await iexecProxy.teebroker());

    const schedulerMessage = buildContributionAuthorizationMessage(
        worker.address,
        taskId,
        ethers.ZeroAddress,
    );
    console.log(schedulerMessage);
    let schedulerSignatureString = '';
    if (workerpoolAddress == workerpoolFromScaAddress) {
        const schedulerMessageHash = hashSafeMessage(schedulerMessage);
        const schedulerSignature = await protocolKit.signMessage(
            protocolKit.createMessage(schedulerMessage),
            SigningMethod.ETH_SIGN,
        );
        schedulerSignatureString = schedulerSignature.getSignature(eoaSigner.address)?.data;
        console.log(
            await protocolKit.isValidSignature(schedulerMessageHash, schedulerSignatureString),
        );
    } else {
        schedulerSignatureString = await signMessage(scheduler, schedulerMessage);
    }
    if (!schedulerSignatureString) {
        process.exit(1);
    }
    // process.exit(1);

    const { results, resultDigest } = buildUtf8ResultAndDigest('result');
    // const enclaveMessage = buildEnclaveMessage(worker.address, taskId, resultDigest);
    // const enclaveMessageHash = hashSafeMessage(enclaveMessage);
    // const enclaveSignature = await protocolKit.signMessage(
    //     protocolKit.createMessage(enclaveMessage),
    // );
    // const enclaveSignatureString = enclaveSignature.getSignature(eoaSigner.address)?.data;
    // console.log(await protocolKit.isValidSignature(enclaveMessageHash, enclaveSignatureString));
    // if (!enclaveSignatureString) {
    //     process.exit(1);
    // }

    await iexecBoost
        .connect(worker)
        .pushResultBoost(
            dealId,
            taskIndex,
            results,
            '0x',
            schedulerSignatureString,
            ethers.ZeroAddress, //enclave.address,
            '0x', //enclaveSignatureString,
        )
        .then((tx) => tx.wait());

    process.exit(1);

    const txHash = await smartAccountClient.sendTransaction({
        to: iexecProxyAddress as Address,
        data: (
            await iexecBoost.pushResultBoost.populateTransaction(
                dealId,
                taskIndex,
                results,
                '0x',
                schedulerSignatureString,
                ethers.ZeroAddress, //enclave.address,
                '0x', //enclaveSignatureString,
            )
        ).data as `0x${string}`,
    });
    logTx(txHash);
})().catch((error) => console.log(error));

async function signOrderWithSafeOwnerSigner(
    domain: { name: string; version: string; chainId: bigint; verifyingContract: string },
    order:
        | IexecLibOrders_v5.AppOrderStruct
        | IexecLibOrders_v5.DatasetOrderStruct
        | IexecLibOrders_v5.WorkerpoolOrderStruct
        | IexecLibOrders_v5.RequestOrderStruct,
    protocolKit: ProtocolKit,
) {
    const eip712Order = getEip712TypedDataOrder(domain, order);
    const signature = await protocolKit.signTypedData(protocolKit.createMessage(eip712Order));
    console.log(
        `Order ${hashOrder(domain, order)} signed: ${await protocolKit.isValidSignature(hashSafeMessage(eip712Order), signature.data)}`,
    );
    order.sign = signature.data;
}

function logTx(txHash: string) {
    console.log(`User operation included: https://sepolia.arbiscan.io/tx/${txHash}`);
}
