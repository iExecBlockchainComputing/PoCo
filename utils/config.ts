import json from '../config/config.json';
import { Category } from './poco-tools';

const config = json as Config;

export function isNativeChain(chain?: ChainConfig) {
    if (process.env.IS_NATIVE_CHAIN) {
        return process.env.IS_NATIVE_CHAIN === 'true';
    }
    if (chain) {
        return chain.asset === 'Native';
    }
    return false;
}

export function isLocalFork() {
    return process.env.LOCAL_FORK === 'true';
}

export function isArbitrumSepoliaFork() {
    return process.env.ARBITRUM_SEPOLIA_FORK === 'true';
}

export function isArbitrumFork() {
    return process.env.ARBITRUM_FORK === 'true';
}

/**
 * Get the config of the current chain or throw if it is not defined.
 */
function getChainConfig(chainId: bigint): ChainConfig {
    const chainConfig = config.chains[chainId.toString()];
    if (!chainConfig) {
        throw new Error(`Chain config undefined for chain ${chainId}`);
    }
    return chainConfig;
}

type Config = {
    categories: Category[];
    registriesBaseUri: {
        app: string;
        dataset: string;
        workerpool: string;
    };
    chains: {
        [key: string]: ChainConfig;
    };
};

type ChainConfig = {
    name: string;
    deployer: string;
    _deployerComment?: string;
    owner: string;
    _ownerComment?: string;
    asset: string;
    _assetComment?: string;
    token?: string | null; // The token deployed should be compatible with Approve and call
    _tokenComment?: string;
    richman?: string | null; // The richman account is needed if the token is already deployed
    uniswap?: boolean;
    _uniswapComment?: string;
    v3: {
        Hub?: string | null;
        AppRegistry?: string | null;
        DatasetRegistry?: string | null;
        WorkerpoolRegistry?: string | null;
    };
    v5: {
        factory?: string;
        factoryType?: string;
        salt?: string;
        AppRegistry?: string;
        DatasetRegistry?: string;
        WorkerpoolRegistry?: string;
        ERC1538Proxy?: string; // Deprecated, use DiamondProxy instead TODO: to remove
        // TODO: check if this is still needed or if hre.deployments.get('Diamond') is enough.
        DiamondProxy?: string;
        // TODO: check if this is still needed or if hre.deployments.get('IexecLibOrders_v5') is enough.
        IexecLibOrders_v5?: string;
    };
};

export default {
    ...config,
    isNativeChain,
    isLocalFork,
    isArbitrumSepoliaFork,
    isArbitrumFork,
    getChainConfig,
};
