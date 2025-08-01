// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/**
 * Full-chain integration test scenarios on live Arbitrum Sepolia network
 *
 * This script replicates key scenarios from test/000_fullchain.test.ts
 * but runs them on the live Arbitrum Sepolia network with simplified configuration:
 * - Single worker setup (scheduler acts as worker)
 * - Real network behavior vs fork/local testing
 * - Signature verification in production environment
 * - Gas usage and transaction costs
 * - Contract interactions under real network conditions
 *
 * Usage: npx hardhat run scripts/test-fullchain-live-arbitrum-sepolia.ts --network arbitrumSepolia
 */

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { IexecWrapper } from '../test/utils/IexecWrapper';
import { randomAddress } from '../test/utils/utils';
import { IexecInterfaceToken, IexecInterfaceToken__factory } from '../typechain';
import config from '../utils/config';
import { OrdersActors, OrdersAssets, OrdersPrices, buildOrders } from '../utils/createOrders';
import {
    TaskStatusEnum,
    buildResultCallbackAndDigest,
    buildUtf8ResultAndDigest,
    getIexecAccounts,
} from '../utils/poco-tools';

// Test configuration - same as fullchain.test.ts
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const standardDealTag = '0x0000000000000000000000000000000000000000000000000000000000000000';
const teeDealTag = '0x0000000000000000000000000000000000000000000000000000000000000001';
const appPrice = 0n;
const datasetPrice = 0n;
const workerpoolPrice = 0n;
const callbackAddress = randomAddress();
const { results, resultDigest } = buildUtf8ResultAndDigest('result');
const { resultsCallback, callbackResultDigest } = buildResultCallbackAndDigest(123);

interface TestResults {
    networkType: string;
    chainId: number;
    timestamp: string;
    contractAddress: string;
    scenarios: Array<{
        id: string;
        name: string;
        success: boolean;
        error?: string;
        gasUsed?: string; // Store as string to avoid BigInt serialization issues
        dealId?: string;
        executionTimeMs?: number;
    }>;
    summary: {
        totalScenarios: number;
        successfulScenarios: number;
        failedScenarios: number;
        totalGasUsed: string;
        totalExecutionTimeMs: number;
    };
}

// Global test state
let proxyAddress: string;
let iexecPoco: IexecInterfaceToken;
let iexecWrapper: IexecWrapper;
let appAddress: string;
let workerpoolAddress: string;
let datasetAddress: string;
let ordersActors: OrdersActors;
let ordersAssets: OrdersAssets;
let ordersPrices: OrdersPrices;

let [
    requester,
    sponsor,
    beneficiary,
    appProvider,
    datasetProvider,
    scheduler,
]: SignerWithAddress[] = [];

async function setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');

    // Check network
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        throw new Error(
            `This script requires Arbitrum Sepolia (${ARBITRUM_SEPOLIA_CHAIN_ID}), but connected to chain ${chainId}`,
        );
    }

    // Get configuration
    const chainConfig = config.getChainConfig(BigInt(chainId));
    const proxyAddressFromConfig = chainConfig.v5.DiamondProxy;

    if (!proxyAddressFromConfig) {
        throw new Error('DiamondProxy address not found in config');
    }

    proxyAddress = proxyAddressFromConfig;
    console.log(`📍 Using DiamondProxy at: ${proxyAddress}`);

    // Get accounts from the configured accounts (this will use proper structure)
    const accounts = await getIexecAccounts();
    ({ requester, sponsor, beneficiary, appProvider, datasetProvider, scheduler } = accounts);
    console.log('👥 Test Accounts:');
    console.log(`   Requester: ${requester.address}`);
    console.log(`   Sponsor: ${sponsor.address}`);
    console.log(`   Beneficiary: ${beneficiary.address}`);
    console.log(`   App Provider: ${appProvider.address}`);
    console.log(`   Dataset Provider: ${datasetProvider.address}`);
    console.log(`   Scheduler/Worker: ${scheduler.address}`);

    // Initialize contracts
    iexecPoco = IexecInterfaceToken__factory.connect(proxyAddress, requester);
    iexecWrapper = new IexecWrapper(proxyAddress, accounts);

    // console.log('🏗️  Creating test assets...');
    // Create assets (apps, datasets, workerpools)
    // const assets = await iexecWrapper.createAssets();
    // appAddress = assets.appAddress;
    // datasetAddress = assets.datasetAddress;
    // workerpoolAddress = assets.workerpoolAddress;
    // console.log(`   App: ${appAddress}`);
    // console.log(`   Dataset: ${datasetAddress}`);
    // console.log(`   Workerpool: ${workerpoolAddress}`);

    console.log('Using hardcoded addresses for simplicity in live tests');
    appAddress = '0x9930265b09a8f0d014729fa63b7f2c6184eaf856';
    datasetAddress = '0x7E065F61B3b495c84f36277B656f61a5c0B0F918';
    workerpoolAddress = '0x78908CD2Da8C7002f454CADcAafF9680D8167c59';

    console.log(`   App: ${appAddress}`);
    console.log(`   Dataset: ${datasetAddress}`);
    console.log(`   Workerpool: ${workerpoolAddress}`);

    // Setup orders configuration
    ordersActors = {
        appOwner: appProvider,
        datasetOwner: datasetProvider,
        workerpoolOwner: scheduler,
        requester: requester,
    };

    ordersAssets = {
        app: appAddress,
        dataset: datasetAddress,
        workerpool: workerpoolAddress,
    };

    ordersPrices = {
        app: appPrice,
        dataset: datasetPrice,
        workerpool: workerpoolPrice,
    };

    console.log('✅ Test environment setup complete!\n');
}

async function runScenario1(): Promise<{
    success: boolean;
    error?: string;
    gasUsed?: bigint;
    dealId?: string;
}> {
    console.log('🧪 Running Scenario [1]: Single Worker Standard Deal');
    console.log('   Features: Sponsorship x, Single Worker ✓, Beneficiary ✓, Callback ✓');

    try {
        const volume = 1n; // Single task for single worker
        const workers = [scheduler]; // Use scheduler as the single worker

        // Generate unique salt for this test run to avoid order reuse
        const uniqueSalt = ethers.keccak256(
            ethers.toUtf8Bytes(`test-run-${Date.now()}-${Math.random()}`),
        );
        console.log(`   🧂 Using unique salt: ${uniqueSalt}`);

        const orders = buildOrders({
            assets: ordersAssets,
            prices: ordersPrices,
            requester: requester.address,
            tag: standardDealTag,
            beneficiary: beneficiary.address,
            callback: callbackAddress,
            volume,
            trust: BigInt(workers.length ** 2 - 1), // 0 trust for single worker
            salt: uniqueSalt, // Use unique salt to prevent order reuse
        });

        console.log('   📝 Signing and matching orders...');
        const { dealId } = await iexecWrapper.signAndMatchOrders(...orders.toArray());

        console.log(`   🎯 Deal created: ${dealId}`);

        let totalGasUsed = 0n;

        // Process the single task
        const taskIndex = 0n;
        console.log(`   📋 Processing task ${taskIndex + 1n}/${volume}...`);

        console.log(`   🔄 Initializing task...`);
        const taskId = await iexecWrapper.initializeTask(dealId, taskIndex);
        console.log(`   ✅ Task initialized: ${taskId}`);

        // Contribute with the single worker (scheduler)
        console.log(`   🔨 Worker (scheduler) contributing to task...`);
        await iexecWrapper.contributeToTask(dealId, taskIndex, callbackResultDigest, scheduler);
        console.log(`   ✅ Contribution submitted`);

        // Reveal contribution from the single worker
        console.log(`   🔍 Worker (scheduler) revealing contribution...`);
        const revealTx = await iexecPoco.connect(scheduler).reveal(taskId, callbackResultDigest);
        const revealReceipt = await revealTx.wait();
        if (revealReceipt?.gasUsed) totalGasUsed += revealReceipt.gasUsed;
        console.log(`   ✅ Contribution revealed`);

        // Finalize task (scheduler finalizes as they are also the worker)
        console.log(`   🏁 Scheduler finalizing task...`);
        const finalizeTx = await iexecPoco
            .connect(scheduler)
            .finalize(taskId, results, resultsCallback);
        const receipt = await finalizeTx.wait();
        if (receipt?.gasUsed) totalGasUsed += receipt.gasUsed;
        console.log(`   ✅ Task finalized`);

        // Verify task completion
        const task = await iexecPoco.viewTask(taskId);
        if (Number(task.status) !== TaskStatusEnum.COMPLETED) {
            throw new Error(`Task ${taskIndex} not completed properly`);
        }

        console.log(`   ✅ Task completed successfully`);
        return {
            success: true,
            gasUsed: totalGasUsed,
            dealId,
        };
    } catch (error: any) {
        console.log(`   ❌ Scenario [1] failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🌐 Full-chain Integration Tests on Live Arbitrum Sepolia Network');
    console.log('==============================================================\n');
    const network = await ethers.provider.getNetwork();

    // Initialize test results
    const results: TestResults = {
        networkType: 'live-arbitrum-sepolia',
        chainId: Number(network.chainId),
        timestamp: new Date().toISOString(),
        contractAddress: '',
        scenarios: [],
        summary: {
            totalScenarios: 1,
            successfulScenarios: 0,
            failedScenarios: 0,
            totalGasUsed: '0',
            totalExecutionTimeMs: 0,
        },
    };

    let totalGasUsed = 0n;

    try {
        // Setup environment
        await setupTestEnvironment();
        results.contractAddress = proxyAddress;

        // Run each test scenario
        const scenarios = [{ fn: runScenario1, id: '[1]', name: 'Single Worker Standard Deal' }];

        for (const scenario of scenarios) {
            const scenarioStartTime = Date.now();
            console.log(`\n${'='.repeat(60)}`);

            const scenarioResult = await scenario.fn();
            const executionTimeMs = Date.now() - scenarioStartTime;

            const resultData = {
                id: scenario.id,
                name: scenario.name,
                success: scenarioResult.success,
                error: scenarioResult.error,
                gasUsed: scenarioResult.gasUsed?.toString(),
                dealId: scenarioResult.dealId,
                executionTimeMs,
            };

            results.scenarios.push(resultData);

            if (scenarioResult.success) {
                results.summary.successfulScenarios++;
                console.log(`   ⏱️  Execution time: ${executionTimeMs}ms`);
                if (scenarioResult.gasUsed) {
                    console.log(`   ⛽ Gas used: ${scenarioResult.gasUsed.toLocaleString()}`);
                    totalGasUsed += scenarioResult.gasUsed;
                }
            } else {
                results.summary.failedScenarios++;
            }

            results.summary.totalExecutionTimeMs += executionTimeMs;
        }
    } catch (error: any) {
        console.error(`💥 Critical error during test execution: ${error.message}`);
        console.error(error.stack);
    }

    console.log('📋 Scenario Results:');
    results.scenarios.forEach((scenario) => {
        const status = scenario.success ? '✅ PASS' : '❌ FAIL';
        const gasInfo = scenario.gasUsed
            ? ` (${BigInt(scenario.gasUsed).toLocaleString()} gas)`
            : '';
        const timeInfo = ` (${scenario.executionTimeMs}ms)`;
        console.log(`  ${scenario.id} ${scenario.name}: ${status}${gasInfo}${timeInfo}`);
        if (scenario.error) {
            console.log(`      Error: ${scenario.error}`);
        }
        if (scenario.dealId) {
            console.log(`      Deal ID: ${scenario.dealId}`);
        }
    });

    console.log('');
    console.log('📈 Summary Statistics:');
    console.log(
        `  ✅ Successful: ${results.summary.successfulScenarios}/${results.summary.totalScenarios}`,
    );
    console.log(
        `  ❌ Failed: ${results.summary.failedScenarios}/${results.summary.totalScenarios}`,
    );
    console.log(
        `  📊 Success Rate: ${((results.summary.successfulScenarios / results.summary.totalScenarios) * 100).toFixed(1)}%`,
    );
}

// Error handling
main()
    .then(() => {
        console.log('\n🏁 Full-chain integration test completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Test script failed:', error);
        process.exit(1);
    });
