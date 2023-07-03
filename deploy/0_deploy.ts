import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import initial_migration from '../migrations/1_initial_migration';
import deploy_token from '../migrations/3_deploy_token';
import deploy_core from '../migrations/4_deploy_core';
import deploy_ens from '../migrations/5_deploy_ens';
import whitelisting from '../migrations/6_whitelisting';
import functions from '../migrations/999_functions';
import { getFunctionSignatures } from '../migrations/utils/getFunctionSignatures';
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy');
import {
  ERC1538Proxy,
  IexecAccessors__factory,
  IexecPocoBoostDelegate,
  IexecPocoBoostDelegate__factory,
  ERC1538Update,
  ERC1538Update__factory,
  ERC1538Query,
  ERC1538Query__factory,
} from '../typechain';

/**
 * @dev Deploying contracts with `npx hardhat deploy` task brought by
 * `hardhat-deploy` plugin.
 * Previous deployments made with `npx hardhat run scripts/deploy.ts` used to
 * hang at the end of deployments (terminal did not return at the end).
 *
 * Note:
 * The`hardhat-deploy` plugin is currently being under used compared to all
 * features available in it.
 */
module.exports = async function () {
  console.log('Deploying PoCo Nominal..');
  const accounts = await hre.web3.eth.getAccounts();
  await initial_migration();
  await deploy_token(accounts);
  await deploy_core(accounts);
  await deploy_ens(accounts);
  await whitelisting(accounts);
  // Retrieve proxy address from previous truffle-fixture deployment
  const { address: erc1538ProxyAddress } = await erc1538Proxy.deployed();
  if (!erc1538ProxyAddress) {
    console.error('Failed to retrieve deployed address of ERC1538Proxy');
    process.exitCode = 1;
  }
  console.log(`ERC1538Proxy found: ${erc1538ProxyAddress}`);
  // Save addresses of deployed PoCo Nominal contracts for later use
  saveDeployedAddress('ERC1538Proxy', erc1538ProxyAddress);

  console.log('Deploying PoCo Boost..');
  const [owner] = await hre.ethers.getSigners();
  const iexecPocoBoostInstance: IexecPocoBoostDelegate = await new IexecPocoBoostDelegate__factory()
    .connect(owner)
    .deploy()
    .then((instance) => instance.deployed());
  console.log(`IexecPocoBoostDelegate deployed: ${iexecPocoBoostInstance.address}`);

  // Show proxy functions
  await functions(accounts);

  const erc1538: ERC1538Update = ERC1538Update__factory.connect(erc1538ProxyAddress, owner);
  console.log(`IexecInstance found at address: ${erc1538.address}`);
  // Link IexecPocoBoost methods to ERC1538Proxy
  await erc1538.updateContract(
    iexecPocoBoostInstance.address,
    getFunctionSignatures(IexecPocoBoostDelegate__factory.abi),
    'Linking ' + IexecPocoBoostDelegate__factory.name,
  );
  // Verify linking on ERC1538Proxy
  const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory.connect(erc1538ProxyAddress, owner);
  const functionCount = await erc1538QueryInstance.totalFunctions();
  console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
  await Promise.all(
    [...Array(functionCount.toNumber()).keys()].map(async (i) => {
      const [method, _, contract] = await erc1538QueryInstance.functionByIndex(i);
      if (contract == iexecPocoBoostInstance.address) {
        console.log(`[${i}] ${contract} (IexecPocoBoostDelegate) ${method}`);
      }
    }),
  );

  return iexecPocoBoostInstance;
};

// TODO [optional]: Use hardhat-deploy to save addresses automatically
// https://github.com/wighawag/hardhat-deploy/tree/master#hardhat-deploy-in-a-nutshell
/**
 * Save addresses of deployed contracts (since hardhat does not do it for us).
 * @param contractName contract name to deploy
 * @param deployedAddress address where contract where deployed
 */
function saveDeployedAddress(contractName: string, deployedAddress: string) {
  const chainId = hre.network.config.chainId || 0;
  const BUILD_DIR = '../build';
  fs.writeFileSync(
    path.resolve(__dirname, BUILD_DIR, `${contractName}.json`),
    JSON.stringify({
      networks: {
        [chainId]: {
          address: deployedAddress,
        },
      },
    }),
  );
  console.log(`Saved deployment at ${deployedAddress} for ${contractName}`);
}
