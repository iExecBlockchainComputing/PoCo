import { ethers } from 'hardhat';
import { Category } from '../utils/poco-tools';
import jsonConfig from './config-tmp.json';

export const TOKEN = 'Token';
export const NATIVE = 'Native';

export const config = jsonConfig as Config;

// export async function isTokenMode() {
//     const chainId = (await ethers.provider.getNetwork()).chainId;
// }

/**
 * Get the config of the current chain or throw if it is not defined.
 */
export async function getChainConfig(): Promise<ChainConfig> {
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const chainConfig = config.chains[chainId];
    if (!chainConfig) {
        throw new Error(`Chain config undefined for chain ${chainId}`);
    }
    // _checkAssetType(chainConfig.asset);
    return new ChainConfig(chainConfig);
}

/**
 * Get the config of the current chain if defined or the default config.
 */
export function getDefaultChainConfig(): ChainConfig {
    // _checkAssetType(chainConfig.asset);
    return new ChainConfig(config.chains.default);
}

/**
 * Get the config of the current chain if defined or the default config.
 */
export async function getChainOrDefaultConfig(): Promise<ChainConfig> {
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    const chainConfig = config.chains[Number(chainId)] || config.chains.default;
    // _checkAssetType(chainConfig.asset);
    return new ChainConfig(chainConfig);
}

export class ChainConfig implements Chain {
    _comment: string;
    asset: string;
    token?: string | null;
    uniswap?: boolean;
    etoken?: string;
    v3: V3;
    v5: V5;

    constructor(chainConfig: Chain) {
        if (chainConfig.asset != TOKEN && chainConfig.asset != NATIVE) {
            throw new Error('Invalid asset type');
        }
        this._comment = chainConfig._comment;
        this.asset = chainConfig.asset;
        this.token = chainConfig.token;
        this.uniswap = chainConfig.uniswap;
        this.etoken = chainConfig.etoken;
        this.v3 = chainConfig.v3;
        this.v5 = chainConfig.v5;
    }

    isTokenMode() {
        return this.asset === TOKEN;
    }

    isNativeMode() {
        return this.asset === NATIVE;
    }
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
    v3: V3;
    v5: V5;
};

type V3 = {
    Hub: string | null;
    AppRegistry: string | null;
    DatasetRegistry: string | null;
    WorkerpoolRegistry: string | null;
};

type V5 = {
    usefactory: boolean;
    salt?: string;
    AppRegistry?: string;
    DatasetRegistry?: string;
    WorkerpoolRegistry?: string;
    ERC1538Proxy?: string;
    IexecLibOrders_v5?: string;
};

// function _checkAssetType(asset: string) {
//     if (asset != TOKEN && asset != NATIVE) {
//         throw new Error('Invalid asset type');
//     }
// }
