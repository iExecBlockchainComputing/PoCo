import { IexecDepositAndMatchOrdersFacet__factory } from '../../typechain';
import {
    deployFacets,
    FacetDetails,
    getUpgradeContext,
    linkFacetsToDiamond,
    printOnchainDiamondDescription,
    saveOnchainDiamondDescription,
} from '../../utils/proxy-tools';
import { tryVerify } from '../verify';

async function main() {
    console.log('Deploying and adding DepositAndMatchOrders facet to diamond proxy...');

    const { chainId, networkName, deployer, proxyOwner, proxyAddress, iexecLibOrders } =
        await getUpgradeContext();

    console.log(`Network: ${networkName} (${chainId})`);
    console.log(`Diamond proxy address: ${proxyAddress}`);

    const facetsToAdd: FacetDetails[] = [
        {
            name: 'IexecDepositAndMatchOrdersFacet',
            address: null,
            factory: new IexecDepositAndMatchOrdersFacet__factory(iexecLibOrders),
        },
    ];

    // Print diamond description before upgrade
    await printOnchainDiamondDescription(proxyAddress);
    await deployFacets(deployer, chainId, facetsToAdd); // Adds deployed addresses to `facetsToAdd`.
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
