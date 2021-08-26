const assert = require("assert");
// CONFIG
const CONFIG = require("../config/config.json");
const ACCOUNTS = require("../config/accounts.json");
// Token
const RLC = artifacts.require("rlc-faucet-contract/RLC");
// ERC1538 core & delegates
const ERC1538Proxy = artifacts.require("@iexec/solidity/ERC1538Proxy");
// Interface
const IexecInterfaceToken = artifacts.require("IexecInterfaceToken");

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function (deployer, network, accounts) {
  console.log("# web3 version:", web3.version);
  const chainid = await web3.eth.net.getId();
  const chaintype = await web3.eth.net.getNetworkType();
  console.log("Chainid is:", chainid);
  console.log("Chaintype is:", chaintype);
  console.log("Deployer is:", accounts[0]);

  const deploymentOptions = CONFIG.chains[chainid] || CONFIG.chains.default;

  //only for standard token private chains
  if (
    chainid > 134 &&
    deploymentOptions.asset === "Token" &&
    !process.env.KYC
  ) {
    const IexecInterfaceInstance = await IexecInterfaceToken.at(
      (
        await ERC1538Proxy.deployed()
      ).address
    );
    const totalAmount = 1000000000; // 1RLC

    const RLCInstance = await RLC.deployed();
    await RLCInstance.approveAndCall(
      IexecInterfaceInstance.address,
      totalAmount,
      "0x"
    );
    // all transfers
    await Promise.all(
      ACCOUNTS.map(({ address, amount }) => {
        console.log("Transferring for address " + address + ": " + amount);
        IexecInterfaceInstance.transfer(address, amount);
      })
    );
  }
};
