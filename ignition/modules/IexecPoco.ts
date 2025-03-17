import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ZeroAddress } from 'ethers';
import {
    ENSIntegrationDelegate__factory,
    ERC1538QueryDelegate__factory,
    IexecAccessorsABILegacyDelegate__factory,
    IexecAccessorsDelegate__factory,
    IexecCategoryManagerDelegate__factory,
    IexecERC20Delegate__factory,
    IexecEscrowNativeDelegate__factory,
    IexecEscrowTokenDelegate__factory,
    IexecMaintenanceDelegate__factory,
    IexecMaintenanceExtraDelegate__factory,
    IexecOrderManagementDelegate__factory,
    IexecPoco1Delegate__factory,
    IexecPoco2Delegate__factory,
    IexecPocoAccessorsDelegate__factory,
    IexecPocoBoostAccessorsDelegate__factory,
    IexecPocoBoostDelegate__factory,
    IexecRelayDelegate__factory,
} from '../../typechain';
import config from '../../utils/config';
import { getFunctionSignatures } from '../../utils/proxy-tools';

//TODO: Fix hardcode
const chainId = 11155111n;
const deploymentOptions = config.getChainConfigOrDefault(chainId);
// Create a mapping of contract names to their ABIs
const contractABIs: Record<string, any> = {
    ERC1538QueryDelegate: ERC1538QueryDelegate__factory.abi,
    IexecAccessorsDelegate: IexecAccessorsDelegate__factory.abi,
    IexecAccessorsABILegacyDelegate: IexecAccessorsABILegacyDelegate__factory.abi,
    IexecCategoryManagerDelegate: IexecCategoryManagerDelegate__factory.abi,
    IexecERC20Delegate: IexecERC20Delegate__factory.abi,
    IexecEscrowTokenDelegate: IexecEscrowTokenDelegate__factory.abi,
    IexecEscrowNativeDelegate: IexecEscrowNativeDelegate__factory.abi,
    IexecMaintenanceDelegate: IexecMaintenanceDelegate__factory.abi,
    IexecOrderManagementDelegate: IexecOrderManagementDelegate__factory.abi,
    IexecPoco1Delegate: IexecPoco1Delegate__factory.abi,
    IexecPoco2Delegate: IexecPoco2Delegate__factory.abi,
    IexecRelayDelegate: IexecRelayDelegate__factory.abi,
    ENSIntegrationDelegate: ENSIntegrationDelegate__factory.abi,
    IexecMaintenanceExtraDelegate: IexecMaintenanceExtraDelegate__factory.abi,
    IexecPocoAccessorsDelegate: IexecPocoAccessorsDelegate__factory.abi,
    IexecPocoBoostDelegate: IexecPocoBoostDelegate__factory.abi,
    IexecPocoBoostAccessorsDelegate: IexecPocoBoostAccessorsDelegate__factory.abi,
};
/**
 * Module for deploying RLC token when needed
 */
const rlcModule = buildModule('rlcModule', (m) => {
    const rlc = m.contract('RLC');
    return { rlc };
});

/**
 * Module for deploying ERC1538 proxy contracts
 */
const erc1538Module = buildModule('erc1538Module', (m) => {
    const erc1538UpdateDelegate = m.contract('ERC1538UpdateDelegate', [], {
        from: m.getAccount(0),
    });
    const erc1538Proxy = m.contract('ERC1538Proxy', [erc1538UpdateDelegate], {
        after: [erc1538UpdateDelegate],
        from: m.getAccount(0),
    });

    // m.call(erc1538Proxy, 'transferOwnership', [m.getAccount(0)], {
    //     id: 'transferOwnership',
    //     after: [erc1538Proxy],
    // });

    return { erc1538Proxy, erc1538UpdateDelegate };
});

/**
 * Module for deploying the library
 */
const librariesModule = buildModule('librariesModule', (m) => {
    const iexecLibOrders = m.library('IexecLibOrders_v5');
    return { iexecLibOrders };
});

/**
 * Module for deploying delegates
 */
const delegatesModule = buildModule('delegatesModule', (m) => {
    const { iexecLibOrders } = m.useModule(librariesModule);
    const isTokenMode = !config.isNativeChain(deploymentOptions);

    // Deploy each contract separately
    const ERC1538QueryDelegate = m.contract('ERC1538QueryDelegate');
    const IexecAccessorsDelegate = m.contract('IexecAccessorsDelegate');
    const IexecAccessorsABILegacyDelegate = m.contract('IexecAccessorsABILegacyDelegate');
    const IexecCategoryManagerDelegate = m.contract('IexecCategoryManagerDelegate');
    const IexecERC20Delegate = m.contract('IexecERC20Delegate');
    let IexecEscrowDelegate;
    if (isTokenMode) {
        IexecEscrowDelegate = m.contract('IexecEscrowTokenDelegate');
    } else {
        IexecEscrowDelegate = m.contract('IexecEscrowNativeDelegate');
    }
    const IexecMaintenanceDelegate = m.contract('IexecMaintenanceDelegate', [], {
        libraries: { 'contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5': iexecLibOrders },
        after: [iexecLibOrders],
    });
    const IexecOrderManagementDelegate = m.contract('IexecOrderManagementDelegate', [], {
        libraries: { 'contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5': iexecLibOrders },
        after: [iexecLibOrders],
    });
    const IexecPoco1Delegate = m.contract('IexecPoco1Delegate', [], {
        libraries: { 'contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5': iexecLibOrders },
        after: [iexecLibOrders],
    });
    const IexecPoco2Delegate = m.contract('IexecPoco2Delegate');
    const IexecRelayDelegate = m.contract('IexecRelayDelegate');
    const ENSIntegrationDelegate = m.contract('ENSIntegrationDelegate');
    const IexecMaintenanceExtraDelegate = m.contract('IexecMaintenanceExtraDelegate');
    const IexecPocoAccessorsDelegate = m.contract('IexecPocoAccessorsDelegate', [], {
        libraries: { 'contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5': iexecLibOrders },
        after: [iexecLibOrders],
    });
    const IexecPocoBoostDelegate = m.contract('IexecPocoBoostDelegate', [], {
        libraries: { 'contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5': iexecLibOrders },
        after: [iexecLibOrders],
    });
    const IexecPocoBoostAccessorsDelegate = m.contract('IexecPocoBoostAccessorsDelegate');

    return {
        ERC1538QueryDelegate,
        IexecAccessorsDelegate,
        IexecAccessorsABILegacyDelegate,
        IexecCategoryManagerDelegate,
        IexecERC20Delegate,
        IexecEscrowDelegate,
        IexecMaintenanceDelegate,
        IexecOrderManagementDelegate,
        IexecPoco1Delegate,
        IexecPoco2Delegate,
        IexecRelayDelegate,
        ENSIntegrationDelegate,
        IexecMaintenanceExtraDelegate,
        IexecPocoAccessorsDelegate,
        IexecPocoBoostDelegate,
        IexecPocoBoostAccessorsDelegate,
    };
});

/**
 * Module for deploying registries
 */
const registriesModule = buildModule('registriesModule', (m) => {
    const appRegistry = m.contract('AppRegistry');
    const datasetRegistry = m.contract('DatasetRegistry');
    const workerpoolRegistry = m.contract('WorkerpoolRegistry');

    // [appRegistry, datasetRegistry, workerpoolRegistry].forEach((registry) => {
    //     m.call(registry, 'transferOwnership', [m.getAccount(0)], {
    //         after: [registry],
    //     });
    // });

    return { appRegistry, datasetRegistry, workerpoolRegistry };
});

/**
 * Link Modules to ERC1538 Proxy
 */
export default buildModule('iexecPoCo', (m) => {
    const delegates = m.useModule(delegatesModule);
    const { erc1538Proxy, erc1538UpdateDelegate } = m.useModule(erc1538Module);
    const { appRegistry, datasetRegistry, workerpoolRegistry } = m.useModule(registriesModule);

    const isTokenMode = !config.isNativeChain(deploymentOptions);

    let rlcAddress;
    if (isTokenMode && deploymentOptions.token) {
        rlcAddress = deploymentOptions.token;
    } else if (isTokenMode) {
        const { rlc } = m.useModule(rlcModule);
        //TODO: check if it's correct
        rlcAddress = rlc;
    } else {
        rlcAddress = ZeroAddress;
    }

    Object.values(delegates).forEach((delegate) => {
        m.call(
            erc1538UpdateDelegate,
            'updateContract',
            [
                delegate,
                getFunctionSignatures(contractABIs[delegate.contractName]),
                `Linking ${delegate.contractName}`,
            ],
            {
                id: `updateContract_${delegate.contractName}`,
                //TODO: Check if after can be removed
                after: [delegate, erc1538Proxy, erc1538UpdateDelegate],
                from: m.getAccount(0),
            },
        );
    });

    // Verify linking on ERC1538Proxy
    const erc1538QueryInstance = m.contractAt('ERC1538Query', erc1538Proxy);
    const functionCount = m.call(erc1538QueryInstance, 'totalFunctions', [], {
        after: [erc1538Proxy, erc1538UpdateDelegate],
    });
    console.log(`The deployed ERC1538Proxy now supports ${functionCount.value} functions:`);
    for (let i = 0; i < Number(functionCount.value); i++) {
        //TODO: Not sure it's correct here
        const { contract, functionName } = m.call(erc1538Proxy, 'functionByIndex', [i], {
            after: [erc1538Proxy, erc1538UpdateDelegate],
        });
        console.log(`[${i}] ${contract} ${functionName}`);
    }

    // Initialize registries
    m.call(appRegistry, 'initialize', [deploymentOptions.v3.AppRegistry || ZeroAddress], {
        after: [appRegistry],
    });
    m.call(datasetRegistry, 'initialize', [deploymentOptions.v3.DatasetRegistry || ZeroAddress], {
        after: [datasetRegistry],
    });
    m.call(
        workerpoolRegistry,
        'initialize',
        [deploymentOptions.v3.WorkerpoolRegistry || ZeroAddress],
        {
            after: [workerpoolRegistry],
        },
    );

    // Set base URIs
    [
        { registry: appRegistry, uri: config.registriesBaseUri.app },
        { registry: datasetRegistry, uri: config.registriesBaseUri.dataset },
        { registry: workerpoolRegistry, uri: config.registriesBaseUri.workerpool },
    ].forEach(({ registry, uri }) => {
        m.call(registry, 'setBaseURI', [`${uri}/${chainId}/`], {
            after: [registry],
        });
    });

    // Check if contract needs initialization
    const iexecInitialized = m.call(delegates.IexecAccessorsDelegate, 'eip712domain_separator');
    if (!iexecInitialized.value) {
        // Configure main contract only if not initialized
        m.call(
            delegates.IexecMaintenanceDelegate,
            'configure',
            [
                rlcAddress,
                'Staked RLC',
                'SRLC',
                9, // TODO: make this generic?
                appRegistry,
                datasetRegistry,
                workerpoolRegistry,
                ZeroAddress,
            ],
            {
                after: [
                    erc1538Proxy,
                    erc1538UpdateDelegate,
                    appRegistry,
                    datasetRegistry,
                    workerpoolRegistry,
                ],
            },
        );
    }

    // Set categories
    const catCountBefore = m.call(delegates.IexecAccessorsDelegate, 'countCategory', [], {
        id: 'countCategory_before',
        after: [erc1538Proxy, erc1538UpdateDelegate],
    });
    for (let i = Number(catCountBefore.value); i < config.categories.length; i++) {
        const category = config.categories[i];
        m.call(
            delegates.IexecCategoryManagerDelegate,
            'createCategory',
            [category.name, JSON.stringify(category.description), category.workClockTimeRef],
            {
                id: `createCategory_${i}`,
                after: [
                    erc1538Proxy,
                    erc1538UpdateDelegate,
                    appRegistry,
                    datasetRegistry,
                    workerpoolRegistry,
                ],
            },
        );
    }
    const catCountAfter = m.call(delegates.IexecAccessorsDelegate, 'countCategory', [], {
        id: 'countCategory_after',
        after: [erc1538Proxy, erc1538UpdateDelegate],
    });
    console.log(`countCategory is now: ${catCountAfter.value} (was ${catCountBefore.value})`);
    for (let i = 0; i < Number(catCountAfter.value); i++) {
        console.log(
            `Category ${i}: ${m.call(erc1538Proxy, 'viewCategory', [i], {
                after: [erc1538Proxy, erc1538UpdateDelegate],
            })}`,
        );
    }

    return { erc1538Proxy };
});
