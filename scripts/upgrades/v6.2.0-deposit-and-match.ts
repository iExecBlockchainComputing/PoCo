import { IexecPoco1Facet__factory } from '../../typechain';
import {
    deployFacets,
    FacetDetails,
    getUpgradeContext,
    linkFacetsToDiamond,
    printOnchainDiamondDescription,
    removeFacetsFromDiamond,
    saveOnchainDiamondDescription,
} from '../../utils/proxy-tools';
import { tryVerify } from '../verify';

async function main() {
    console.log('Deploying and adding DepositAndMatchOrders facet to diamond proxy...');

    const { chainId, networkName, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    const facetAddressesPerChain: { [key: string]: { [key: string]: string } } = {
        // Arbitrum sepolia
        '421614': {
            IexecPoco1Facet: '0xC8dE3913fcdBC576970dCe24eE416CA25681f65f',
        },
        // Arbitrum mainnet
        '42161': {
            IexecPoco1Facet: '0x46b555fE117DFd8D4eAC2470FA2d739c6c3a0152',
        },
    };
    const facetsToRemove: FacetDetails[] = [
        {
            name: 'IexecPoco1Facet',
            address: facetAddressesPerChain[chainId.toString()]['IexecPoco1Facet'],
            factory: null,
        },
    ];

    const facetsToAdd: FacetDetails[] = [
        {
            name: 'IexecPoco1Facet',
            address: null,
            factory: new IexecPoco1Facet__factory(iexecLibOrders),
        },
    ];

    // Print diamond description before upgrade
    await printOnchainDiamondDescription(proxyAddress);
    await deployFacets(deployer, chainId, facetsToAdd); // Adds deployed addresses to `facetsToAdd`.
    await removeFacetsFromDiamond(proxyAddress, proxyOwner, facetsToRemove);
    await printOnchainDiamondDescription(proxyAddress);
    await linkFacetsToDiamond(proxyAddress, proxyOwner, facetsToAdd);
    await printOnchainDiamondDescription(proxyAddress);
    console.log('Upgrade performed successfully!');
    await saveOnchainDiamondDescription(proxyAddress, networkName);
    await tryVerify(facetsToAdd.map((facet) => facet.name));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
