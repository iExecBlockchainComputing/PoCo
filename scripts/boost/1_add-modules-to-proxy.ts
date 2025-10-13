// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { time } from '@nomicfoundation/hardhat-network-helpers';
import { BytesLike, ZeroHash } from 'ethers';
import { deployments, ethers } from 'hardhat';
import {
    IexecPocoBoostAccessorsFacet__factory,
    IexecPocoBoostFacet__factory,
    TimelockController__factory,
} from '../../typechain';
import { Ownable__factory } from '../../typechain/factories/rlc-faucet-contract/contracts';
import config from '../../utils/config';
import { getDeployerAndOwnerSigners } from '../../utils/deploy-tools';
import {
    encodeModuleProxyUpdate,
    printBlockTime,
    printFunctions,
} from '../upgrades/upgrade-helper';

(async () => {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const deploymentOptions = config.getChainConfig(chainId).v5;
    console.log('Link Boost functions to proxy:');
    if (!deploymentOptions.DiamondProxy) {
        throw new Error('DiamondProxy is required');
    }
    if (!deploymentOptions.IexecLibOrders_v5) {
        throw new Error('IexecLibOrders_v5 is required');
    }
    const diamondProxyAddress = deploymentOptions.DiamondProxy;
    const iexecPocoBoostFacetAddress = (await deployments.get('IexecPocoBoostFacet')).address; // Bellecour: 0x8425229f979AB3b0dDDe00D475D762cA4d6a5eFc
    const iexecPocoBoostAccessorsFacetAddress = (
        await deployments.get('IexecPocoBoostAccessorsFacet')
    ).address; // Bellecour: 0x56185a2b0dc8b556BBfBAFB702BC971Ed75e868C
    const { owner } = await getDeployerAndOwnerSigners();
    const timelockAddress = await Ownable__factory.connect(diamondProxyAddress, owner).owner(); // Bellecour: 0x4611B943AA1d656Fc669623b5DA08756A7e288E9

    const iexecLibOrders = {
        ['contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
            deploymentOptions.IexecLibOrders_v5,
    };

    const iexecPocoBoostProxyUpdate = encodeModuleProxyUpdate(
        new IexecPocoBoostFacet__factory(iexecLibOrders),
        iexecPocoBoostFacetAddress,
    );
    const iexecPocoBoostAccessorsProxyUpdate = encodeModuleProxyUpdate(
        new IexecPocoBoostAccessorsFacet__factory(),
        iexecPocoBoostAccessorsFacetAddress,
    );
    // Salt but must be the same for schedule & execute
    const operationSalt = '0x0be814a62c44af32241a2c964e5680d1b25c783473c6e7875cbc8071770d7ff0'; // Random
    const delay = BigInt(60 * 60 * 24 * 7);
    const updateProxyArgs = [
        Array(2).fill(diamondProxyAddress),
        Array(2).fill(0),
        [iexecPocoBoostProxyUpdate, iexecPocoBoostAccessorsProxyUpdate],
        ZeroHash,
        operationSalt,
    ] as [string[], bigint[], BytesLike[], BytesLike, BytesLike];
    console.log('Scheduling proxy update..');
    await printBlockTime();
    const timelockInstance = TimelockController__factory.connect(timelockAddress, owner);
    const timelockAdminAddress = await timelockInstance.getRoleMember(
        await timelockInstance.PROPOSER_ROLE(),
        0,
    );
    console.log(`Timelock proposer: ${timelockAdminAddress}`);
    const timelockAdminSigner = await ethers.getImpersonatedSigner(timelockAdminAddress);
    await timelockInstance
        .connect(timelockAdminSigner)
        .scheduleBatch(...updateProxyArgs, delay)
        .then((tx) => {
            console.log(tx);
            tx.wait();
        });
    await time.increase(delay);
    console.log('Time traveling..');
    await printBlockTime();
    await printFunctions(diamondProxyAddress);
    console.log('Executing proxy update..');
    await timelockInstance
        .connect(timelockAdminSigner)
        .executeBatch(...updateProxyArgs)
        .then((tx) => {
            console.log(tx);
            tx.wait();
        });
    await printFunctions(diamondProxyAddress);
})();
