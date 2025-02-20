import { Category } from './poco-tools';
import json from '../config/config.json';

const config = json as Config;

function isNativeChain(chain?: Chain) {
    chain = chain ?? getDefaultChainConfig();
    return chain.asset === 'Native' || process.env.IS_NATIVE_CHAIN === 'true';
}

/**
 * Get the config of the current chain or throw if it is not defined.
 */
function getChainConfig(chainId: bigint): Chain {
    const chainConfig = config.chains[chainId.toString()];
    if (!chainConfig) {
        throw new Error(`Chain config undefined for chain ${chainId}`);
    }
    return chainConfig;
}

function getDefaultChainConfig(): Chain {
    return config.chains.default;
}

type Config = {
    categories: Category[];
    registriesBaseUri: {
        app: string;
        dataset: string;
        workerpool: string;
    };
    chains: {
        [key: string]: Chain;
    };
};

type Chain = {
    _comment: string;
    asset: string;
    token?: string | null;
    uniswap?: boolean;
    etoken?: string;
    v3: {
        Hub: string | null;
        AppRegistry: string | null;
        DatasetRegistry: string | null;
        WorkerpoolRegistry: string | null;
    };
    v5: {
        usefactory: boolean;
        salt: string;
        AppRegistry?: string;
        DatasetRegistry?: string;
        WorkerpoolRegistry?: string;
        ERC1538Proxy?: string;
        IexecLibOrders_v5?: string;
    };
};

export default {
    ...config,
    isNativeChain,
    getChainConfig,
    getDefaultChainConfig,
};
