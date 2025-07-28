import json from '../config/config.json';
import { Category } from './poco-tools';

const config = json as Config;

function isNativeChain(chain?: ChainConfig) {
    chain = chain ?? config.chains.default;
    return chain.asset === 'Native' || process.env.TEST__IS_NATIVE_CHAIN === 'true';
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

function getChainConfigOrDefault(chainId: bigint): ChainConfig {
    return config.chains[chainId.toString()] ?? config.chains.default;
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
    _comment: string;
    asset: string;
    token?: string | null; // The token deployed should be compatible with Approve and call
    richman?: string | null; // The richman account is needed if the token is already deployed
    uniswap?: boolean;
    etoken?: string;
    v3: {
        Hub: string | null;
        AppRegistry: string | null;
        DatasetRegistry: string | null;
        WorkerpoolRegistry: string | null;
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
    getChainConfig,
    getChainConfigOrDefault,
};
