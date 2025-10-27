// scripts/test-match-orders.ts
import { TypedDataEncoder } from 'ethers';
import { ethers } from 'hardhat';
import { IexecWrapper } from '../test/utils/IexecWrapper';
import { fundAccounts } from '../test/utils/fixture-helpers';
import config from '../utils/config';
import { TYPES, hashStruct, hashTypedData, removeSignField, signStruct } from '../utils/odb-tools';
import { getIexecAccounts } from '../utils/poco-tools';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const NULL_SIGNATURE = '0x';
const TAG_TEE = '0x0000000000000000000000000000000000000000000000000000000000000001';

async function main() {
    console.log('\n========================================');
    console.log('🚀 Testing Match Orders with Presigned Orders');
    console.log('========================================\n');

    const accounts = await getIexecAccounts();
    const deployer = accounts.anyone;
    const requester = accounts.requester;
    const scheduler = accounts.scheduler;
    const appProvider = accounts.appProvider;
    const datasetProvider = accounts.datasetProvider;
    const beneficiary = accounts.beneficiary;
    const iexecAdmin = accounts.iexecAdmin;
    // Get signers
    console.log('📋 Signers:');
    console.log('  iexecAdmin :', iexecAdmin.address);
    console.log('  App Provider:', appProvider.address);
    console.log('  Dataset Provider:', datasetProvider.address);
    console.log('  Scheduler:', scheduler.address);
    console.log('  Requester:', requester.address);
    console.log('  Beneficiary:', beneficiary.address);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    console.log('\n🔍 Getting deployment config for chain ID:', chainId.toString());
    // Get deployed contracts
    const chainConfig = config.getChainConfig(chainId);
    const deploymentOptions = chainConfig.v5;

    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }

    const iexecPocoAddress = deploymentOptions.DiamondProxy;

    if (!ethers.isAddress(iexecPocoAddress)) {
        throw new Error(`Invalid IexecPoco address from config: ${iexecPocoAddress}`);
    }

    console.log('📝 IexecPoco address (DiamondProxy):', iexecPocoAddress);
    console.log('📚 IexecLibOrders_v5 address:', deploymentOptions.IexecLibOrders_v5);

    const iexecWrapper = new IexecWrapper(iexecPocoAddress, accounts);
    const iexecPoco = iexecWrapper.iexecPoco;

    // Get RLC token address
    const rlcAddress = await iexecPoco.token();
    console.log('💰 RLC address:', rlcAddress);

    // Fund accounts if richman is available
    if (chainConfig.richman) {
        console.log('\n💸 Funding accounts from richman...');
        await fundAccounts(rlcAddress, chainConfig.richman, false);
        console.log('  ✓ Accounts funded');
    } else {
        console.warn('⚠️  No richman address found, skipping account funding');
    }

    // Deploy test resources
    console.log('\n📦 Deploying test resources...');

    const { appAddress, datasetAddress, workerpoolAddress } = await iexecWrapper.createAssets();

    console.log('  App deployed:', appAddress);
    console.log('  Dataset deployed:', datasetAddress);
    console.log('  Workerpool deployed:', workerpoolAddress);

    // Build orders
    console.log('\n📝 Building orders...');

    const volume = 1n;
    const appPrice = ethers.parseUnits('1', 9); // 1 nRLC
    const datasetPrice = ethers.parseUnits('1', 9);
    const workerpoolPrice = ethers.parseUnits('1', 9);
    const category = 0;
    const trust = 1n;

    const appOrder = {
        app: appAddress,
        appprice: appPrice,
        volume: volume,
        tag: TAG_TEE,
        datasetrestrict: NULL_ADDRESS,
        workerpoolrestrict: NULL_ADDRESS,
        requesterrestrict: NULL_ADDRESS,
        salt: ethers.hexlify(ethers.randomBytes(32)),
        sign: NULL_SIGNATURE,
    };

    const datasetOrder = {
        dataset: datasetAddress,
        datasetprice: datasetPrice,
        volume: volume,
        tag: TAG_TEE,
        apprestrict: NULL_ADDRESS,
        workerpoolrestrict: NULL_ADDRESS,
        requesterrestrict: NULL_ADDRESS,
        salt: ethers.hexlify(ethers.randomBytes(32)),
        sign: NULL_SIGNATURE,
    };

    const workerpoolOrder = {
        workerpool: workerpoolAddress,
        workerpoolprice: workerpoolPrice,
        volume: volume,
        tag: TAG_TEE,
        category: category,
        trust: trust,
        apprestrict: NULL_ADDRESS,
        datasetrestrict: NULL_ADDRESS,
        requesterrestrict: NULL_ADDRESS,
        salt: ethers.hexlify(ethers.randomBytes(32)),
        sign: NULL_SIGNATURE,
    };

    const requestOrder = {
        app: appAddress,
        appmaxprice: appPrice,
        dataset: datasetAddress,
        datasetmaxprice: datasetPrice,
        workerpool: workerpoolAddress,
        workerpoolmaxprice: workerpoolPrice,
        requester: requester.address,
        volume: volume,
        tag: TAG_TEE,
        category: category,
        trust: trust,
        beneficiary: beneficiary.address,
        callback: NULL_ADDRESS,
        params: '<params>',
        salt: ethers.hexlify(ethers.randomBytes(32)),
        sign: NULL_SIGNATURE,
    };

    console.log('  ✓ Orders built');

    // Calculate costs and fund accounts
    console.log('\n💸 Funding accounts...');

    const totalCost = (appPrice + datasetPrice + workerpoolPrice) * volume;
    const schedulerStake = await iexecWrapper.computeSchedulerDealStake(workerpoolPrice, volume);

    console.log('  Total cost:', ethers.formatEther(totalCost), 'RLC');
    console.log('  Scheduler stake:', ethers.formatEther(schedulerStake), 'RLC');

    // Deposit using IexecWrapper
    await iexecWrapper.depositInIexecAccount(requester, totalCost);
    console.log('  ✓ Requester deposited:', ethers.formatEther(totalCost), 'RLC');

    await iexecWrapper.depositInIexecAccount(scheduler, schedulerStake);
    console.log('  ✓ Scheduler deposited:', ethers.formatEther(schedulerStake), 'RLC');

    // Verify balances
    const requesterBalance = await iexecPoco.viewAccount(requester.address);
    const schedulerBalance = await iexecPoco.viewAccount(scheduler.address);
    console.log('  Requester escrow balance:', ethers.formatEther(requesterBalance.stake), 'RLC');
    console.log('  Scheduler escrow balance:', ethers.formatEther(schedulerBalance.stake), 'RLC');

    // Get EIP-712 domain
    console.log('\n🔐 Setting up EIP-712 domain...');

    const domain = {
        name: 'iExecODB',
        version: '5.0.0',
        chainId: Number(chainId), // Convert BigInt to Number
        verifyingContract: iexecPocoAddress,
    };

    console.log('  Domain:', JSON.stringify(domain, null, 2));

    // Sign orders with EIP-712
    // Sign orders using odb-tools
    console.log('\n✍️  Signing orders with EIP-712...');

    console.log('  Signing app order...');
    const signedAppOrder = await signStruct('AppOrder', appOrder, domain, {
        address: appProvider.address,
    });

    console.log('  Signing dataset order...');
    const signedDatasetOrder = await signStruct('DatasetOrder', datasetOrder, domain, {
        address: datasetProvider.address,
    });

    console.log('  Signing workerpool order...');
    const signedWorkerpoolOrder = await signStruct('WorkerpoolOrder', workerpoolOrder, domain, {
        address: scheduler.address,
    });

    console.log('  Signing request order...');
    const signedRequestOrder = await signStruct('RequestOrder', requestOrder, domain, {
        address: requester.address,
    });

    console.log('  ✓ All orders signed');

    // Match orders
    console.log('\n🔍 Verifying signatures on-chain...');

    try {
        // Compute order hashes using odb-tools
        const appOrderHash = hashStruct('AppOrder', signedAppOrder, domain);
        const datasetOrderHash = hashStruct('DatasetOrder', signedDatasetOrder, domain);
        const workerpoolOrderHash = hashStruct('WorkerpoolOrder', signedWorkerpoolOrder, domain);
        const requestOrderHash = hashStruct('RequestOrder', signedRequestOrder, domain);

        console.log('  Order hashes:');
        console.log('    App:', appOrderHash);
        console.log('    Dataset:', datasetOrderHash);
        console.log('    Workerpool:', workerpoolOrderHash);
        console.log('    Request:', requestOrderHash);

        // Verify signatures using contract's verifySignature
        const isAppValid = await iexecPoco.verifySignature(
            appProvider.address,
            appOrderHash,
            signedAppOrder.sign,
        );
        console.log('  App order signature valid?', isAppValid);

        const isDatasetValid = await iexecPoco.verifySignature(
            datasetProvider.address,
            datasetOrderHash,
            signedDatasetOrder.sign,
        );
        console.log('  Dataset order signature valid?', isDatasetValid);

        const isWorkerpoolValid = await iexecPoco.verifySignature(
            scheduler.address,
            workerpoolOrderHash,
            signedWorkerpoolOrder.sign,
        );
        console.log('  Workerpool order signature valid?', isWorkerpoolValid);

        const isRequestValid = await iexecPoco.verifySignature(
            requester.address,
            requestOrderHash,
            signedRequestOrder.sign,
        );
        console.log('  Request order signature valid?', isRequestValid);

        // if (!isAppValid || !isDatasetValid || !isWorkerpoolValid || !isRequestValid) {
        //     throw new Error('❌ One or more signatures are invalid!');
        // }

        // console.log('  ✓ All signatures verified on-chain');

        console.log('\n✍️  Signing orders with EIP-712...');
        console.log('  Signing app order...');

        // Create a clean copy for signing (without sign field)

        await signStruct('AppOrder', appOrder, domain, { address: appProvider.address });

        console.log('\n🔍 Debug App Order:');
        console.log('  Signature added:', appOrder.sign);
        console.log('  Signature length:', appOrder.sign?.length);
        console.log('  Signature type:', typeof appOrder.sign);

        // Test manual recovery using the removeSignField helper
        const types = { AppOrder: TYPES.AppOrder };
        const message = removeSignField(appOrder);

        console.log(
            '  Message for hashing:',
            JSON.stringify(message, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
        );

        const { TypedDataEncoder } = await import('ethers');
        const messageHash = TypedDataEncoder.hash(domain, types, message);
        console.log('  Computed hash:', messageHash);

        const recoveredAddress = ethers.verifyTypedData(domain, types, message, appOrder.sign);
        console.log('  Expected address:', appProvider.address);
        console.log('  Recovered address:', recoveredAddress);
        console.log(
            '  Match?',
            recoveredAddress.toLowerCase() === appProvider.address.toLowerCase(),
        );

        const contractDomainSeparator = await iexecPoco.domain();
        console.log('Contract domain separator:', contractDomainSeparator);
        const eip712DomainSep = await iexecPoco.eip712domain_separator();
        console.log('Contract EIP-712 domain separator:', eip712DomainSep);

        const computedDomainSeparator = TypedDataEncoder.hashDomain(domain);
        console.log('Computed domain separator:', computedDomainSeparator);
    } catch (error: any) {
        console.error('❌ Signature verification failed:', error.message);
        throw error;
    }

    function computeStructHash(typeName: string, message: any) {
        const types = { [typeName]: TYPES[typeName] };
        // This gives us just keccak256(encodeData(...)), not the full EIP-712 hash
        return TypedDataEncoder.hashStruct(typeName, types, message);
    }

    const { sign: _appSign, ...appMessage } = appOrder;
    const { sign: _datasetSign, ...datasetMessage } = datasetOrder;
    const { sign: _workerpoolSign, ...workerpoolMessage } = workerpoolOrder;
    const { sign: _requestSign, ...requestMessage } = requestOrder;

    const appOrderStructHash = computeStructHash('AppOrder', appMessage);
    const datasetOrderStructHash = computeStructHash('DatasetOrder', datasetMessage);
    const workerpoolOrderStructHash = computeStructHash('WorkerpoolOrder', workerpoolMessage);
    const requestOrderStructHash = computeStructHash('RequestOrder', requestMessage);

    console.log('  App struct hash:', appOrderStructHash);
    console.log('  Dataset struct hash:', datasetOrderStructHash);
    console.log('  Workerpool struct hash:', workerpoolOrderStructHash);
    console.log('  Request struct hash:', requestOrderStructHash);

    // Now verify with the contract using STRUCT hashes
    console.log('\n🔍 Verifying with contract (using struct hashes)...');

    // const isAppValid = await iexecPoco.verifySignature(
    //     appProvider.address,
    //     appOrderStructHash,
    //     appOrder.sign
    // );
    // console.log('  App signature valid (struct hash)?', isAppValid);

    console.log('\n🔍 Computing EIP-712 digests...');

    const appOrderDigest = hashTypedData(domain, 'AppOrder', appMessage);
    const datasetOrderDigest = hashTypedData(domain, 'DatasetOrder', datasetMessage);
    const workerpoolOrderDigest = hashTypedData(domain, 'WorkerpoolOrder', workerpoolMessage);
    const requestOrderDigest = hashTypedData(domain, 'RequestOrder', requestMessage);

    console.log('  App digest:', appOrderDigest);
    console.log('  Dataset digest:', datasetOrderDigest);
    console.log('  Workerpool digest:', workerpoolOrderDigest);
    console.log('  Request digest:', requestOrderDigest);

    console.log('\n🔍 Verifying signatures on-chain with digests...');

    const isAppValid = await iexecPoco.verifySignature(
        appProvider.address,
        appOrderDigest,
        appOrder.sign,
    );
    console.log('  App order signature valid?', isAppValid);

    const isDatasetValid = await iexecPoco.verifySignature(
        datasetProvider.address,
        datasetOrderDigest,
        datasetOrder.sign,
    );
    console.log('  Dataset order signature valid?', isDatasetValid);

    const isWorkerpoolValid = await iexecPoco.verifySignature(
        scheduler.address,
        workerpoolOrderDigest,
        workerpoolOrder.sign,
    );
    console.log('  Workerpool order signature valid?', isWorkerpoolValid);

    const isRequestValid = await iexecPoco.verifySignature(
        requester.address,
        requestOrderDigest,
        requestOrder.sign,
    );
    console.log('  Request order signature valid?', isRequestValid);

    console.log('\n🔬 Deep dive into signature verification...');

    // 1. Get the exact digest that ethers used for signing
    const appSignature = appOrder.sign;

    // 2. Manually verify with ethers to see what hash it expects
    // const { TypedDataEncoder } = require('ethers');

    // Compute what ethers thinks the hash should be
    const ethersComputedDigest = TypedDataEncoder.hash(
        domain,
        { AppOrder: TYPES.AppOrder },
        appMessage,
    );

    console.log('  Ethers computed digest:', ethersComputedDigest);
    console.log('  Our computed digest:', appOrderDigest);
    console.log('  Match?', ethersComputedDigest === appOrderDigest);

    // 3. Try to recover the signer using ethers' digest
    const recoveredFromEthersDigest = ethers.recoverAddress(ethersComputedDigest, appSignature);
    console.log('  Recovered from ethers digest:', recoveredFromEthersDigest);
    console.log('  Expected signer:', appProvider.address);
    console.log(
        '  Match?',
        recoveredFromEthersDigest.toLowerCase() === appProvider.address.toLowerCase(),
    );

    // 4. Try to recover using our digest
    const recoveredFromOurDigest = ethers.recoverAddress(appOrderDigest, appSignature);
    console.log('  Recovered from our digest:', recoveredFromOurDigest);

    // 5. Check what the contract's verifySignature actually does
    console.log('\n🔍 Testing contract verifySignature...');
    const isValidWithEthersDigest = await iexecPoco.verifySignature(
        appProvider.address,
        ethersComputedDigest,
        appSignature,
    );
    console.log('  Valid with ethers digest?', isValidWithEthersDigest);

    const isValidWithOurDigest = await iexecPoco.verifySignature(
        appProvider.address,
        appOrderDigest,
        appSignature,
    );
    console.log('  Valid with our digest?', isValidWithOurDigest);

    console.log('\n🔍 Analyzing signature format...');

    const sig = appOrder.sign;
    console.log('  Signature:', sig);
    console.log('  Signature length:', sig.length);
    console.log('  Signature bytes:', (sig.length - 2) / 2); // -2 for '0x', /2 for hex

    // Parse the signature components
    const signature = ethers.Signature.from(sig);
    console.log('  r:', signature.r);
    console.log('  s:', signature.s);
    console.log('  v:', signature.v);
    console.log('  yParity:', signature.yParity);

    // The contract might be sensitive to v value
    // EIP-155: v should be 27 or 28 for legacy, or 0/1 for EIP-2098
    console.log('  Is v normalized (27/28)?', signature.v === 27 || signature.v === 28);

    // Try reconstructing with explicit v normalization
    const normalizedSig = ethers.Signature.from({
        r: signature.r,
        s: signature.s,
        v: signature.v < 27 ? signature.v + 27 : signature.v,
    }).serialized;

    console.log('  Normalized signature:', normalizedSig);

    // Test with normalized signature
    console.log('\n🔍 Testing with normalized signature...');
    const isValidNormalized = await iexecPoco.verifySignature(
        appProvider.address,
        ethersComputedDigest,
        normalizedSig,
    );
    console.log('  Valid with normalized sig?', isValidNormalized);

    // Try the compact 64-byte format (EIP-2098)
    const compactSig = ethers.Signature.from(sig).compactSerialized;
    console.log('\n  Compact signature (64 bytes):', compactSig);
    console.log('  Compact signature length:', compactSig.length);

    const isValidCompact = await iexecPoco.verifySignature(
        appProvider.address,
        ethersComputedDigest,
        compactSig,
    );
    console.log('  Valid with compact sig?', isValidCompact);

    console.log('\n🔍 Testing with different signature encodings...');

    // Current signature is a hex string
    // Try encoding it as bytes
    const sigBytes = ethers.getBytes(sig);
    console.log('  Signature as bytes array length:', sigBytes.length);

    // When passing to the contract, ethers might not be encoding it correctly
    // Try using ethers.solidityPacked or manual encoding

    // Method 1: Ensure it's a proper hex string
    const sigHex = ethers.hexlify(sigBytes);
    console.log('  Method 1 - Hex string:', sigHex);
    const isValid1 = await iexecPoco.verifySignature(
        appProvider.address,
        ethersComputedDigest,
        sigHex,
    );
    console.log('  Valid method 1?', isValid1);

    // Method 2: Use the raw bytes
    const isValid2 = await iexecPoco.verifySignature(
        appProvider.address,
        ethersComputedDigest,
        sigBytes,
    );
    console.log('  Valid method 2?', isValid2);

    console.log('\n🔍 Deep dive into EIP-712 domain...');

    // Check what domain we're using
    console.log('Our domain:', JSON.stringify(domain, null, 2));

    // Try to get the domain from the contract
    try {
        const contractDomain = await iexecPoco.domain();
        console.log('Contract domain:', contractDomain);

        // Compare each field
        console.log('  Name match?', domain.name === contractDomain.name);
        console.log('  Version match?', domain.version === contractDomain.version);
        console.log(
            '  ChainId match?',
            BigInt(domain.chainId.toString()) === contractDomain.chainId,
        );
        console.log(
            '  VerifyingContract match?',
            domain.verifyingContract.toLowerCase() ===
                contractDomain.verifyingContract.toLowerCase(),
        );
    } catch (e: any) {
        console.log('  Cannot read eip712Domain:', e.message.split('(')[0]);
    }

    // Compute domain separator manually
    const domainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
    console.log('Our domain separator:', domainSeparator);

    // Try to get it from contract
    try {
        const contractDomainSep = await iexecPoco.eip712domain_separator();
        console.log('Contract DOMAIN_SEPARATOR:', contractDomainSep);
        console.log('  Match?', domainSeparator === contractDomainSep);
    } catch (e: any) {
        console.log('  Cannot read DOMAIN_SEPARATOR');
    }

    // Check chain ID
    const network = await ethers.provider.getNetwork();
    console.log('Network chain ID:', network.chainId);
    console.log('Domain chain ID:', domain.chainId);
    console.log('  Match?', Number(network.chainId) === Number(domain.chainId));

    // Match orders
    console.log('\n🔗 Matching orders with signatures...');

    // // Presign orders
    // console.log('\n✍️  Presigning orders...');

    // const OPERATION_SIGN = 0;

    // // Presign app order
    // await iexecPoco.connect(appProvider).manageAppOrder({
    //     order: appOrder,
    //     operation: OPERATION_SIGN,
    //     sign: NULL_SIGNATURE,
    // });
    // console.log('  ✓ App order presigned');

    // // Presign dataset order
    // await iexecPoco.connect(datasetProvider).manageDatasetOrder({
    //     order: datasetOrder,
    //     operation: OPERATION_SIGN,
    //     sign: NULL_SIGNATURE,
    // });
    // console.log('  ✓ Dataset order presigned');

    // // Presign workerpool order
    // await iexecPoco.connect(scheduler).manageWorkerpoolOrder({
    //     order: workerpoolOrder,
    //     operation: OPERATION_SIGN,
    //     sign: NULL_SIGNATURE,
    // });
    // console.log('  ✓ Workerpool order presigned');

    // // Presign request order
    // await iexecPoco.connect(requester).manageRequestOrder({
    //     order: requestOrder,
    //     operation: OPERATION_SIGN,
    //     sign: NULL_SIGNATURE,
    // });
    // console.log('  ✓ Request order presigned');

    // // Match orders
    // console.log('\n🔗 Matching orders...');

    try {
        // Connect iexecAdmin (or any account with permission) to send the matchOrders transaction
        const tx = await iexecPoco
            .connect(iexecAdmin)
            .matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder);

        console.log('  Transaction hash:', tx.hash);
        const receipt = await tx.wait();
        console.log('  ✓ Orders matched successfully!');
        console.log('  Gas used:', receipt?.gasUsed.toString());

        // Find the deal ID from events
        const orderMatchedEvent = receipt?.logs.find((log: any) => {
            try {
                const parsed = iexecPoco.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });
                return parsed?.name === 'OrdersMatched';
            } catch {
                return false;
            }
        });

        if (orderMatchedEvent) {
            const parsed = iexecPoco.interface.parseLog({
                topics: orderMatchedEvent.topics as string[],
                data: orderMatchedEvent.data,
            });
            const dealId = parsed?.args[0];
            console.log('\n📋 Deal created!');
            console.log('  Deal ID:', dealId);

            // Fetch and display deal details
            const deal = await iexecPoco.viewDeal(dealId);
            console.log('\n📊 Deal Details:');
            console.log('  App:', deal.app.pointer);
            console.log('  Dataset:', deal.dataset.pointer);
            console.log('  Workerpool:', deal.workerpool.pointer);
            console.log('  Requester:', deal.requester);
            console.log('  Beneficiary:', deal.beneficiary);
            console.log('  Bot first:', deal.botFirst.toString());
            console.log('  Bot size:', deal.botSize.toString());
            console.log('  Category:', deal.category.toString());
            console.log('  Trust:', deal.trust.toString());
            console.log('  Tag:', deal.tag);

            // Verify balances after match
            const requesterBalanceAfter = await iexecPoco.viewAccount(requester.address);
            const schedulerBalanceAfter = await iexecPoco.viewAccount(scheduler.address);
            console.log('\n💰 Balances After Match:');
            console.log(
                '  Requester stake:',
                ethers.formatEther(requesterBalanceAfter.stake),
                'RLC',
            );
            console.log(
                '  Requester locked:',
                ethers.formatEther(requesterBalanceAfter.locked),
                'RLC',
            );
            console.log(
                '  Scheduler stake:',
                ethers.formatEther(schedulerBalanceAfter.stake),
                'RLC',
            );
            console.log(
                '  Scheduler locked:',
                ethers.formatEther(schedulerBalanceAfter.locked),
                'RLC',
            );
        }

        console.log('\n========================================');
        console.log('✅ SUCCESS - Orders matched successfully!');
        console.log('========================================\n');
    } catch (error: any) {
        console.error('\n❌ ERROR - Failed to match orders:');
        console.error('  Message:', error.message);
        if (error.data) {
            console.error('  Data:', error.data);
        }
        if (error.reason) {
            console.error('  Reason:', error.reason);
        }
        console.log('\n========================================');
        console.log('❌ FAILED');
        console.log('========================================\n');
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
