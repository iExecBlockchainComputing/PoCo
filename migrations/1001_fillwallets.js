// CONFIG
const CONFIG = require("../config/config.json");
const ACCOUNTS = require("../config/accounts.json");
// Token
const RLC = artifacts.require("rlc-faucet-contract/RLC");
// ERC1538 core & delegates
const ERC1538Proxy = artifacts.require("@iexec/solidity/ERC1538Proxy");
// Interface
const IexecInterfaceToken = artifacts.require("IexecInterfaceToken");
const IexecInterfaceNative = artifacts.require("IexecInterfaceNative");

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

  //only for standard private chains
  if (chainid > 1000 && !process.env.KYC) {
    let IexecInterfaceInstance;
    const IexecProxyInstance = await ERC1538Proxy.deployed();
    const totalAmount = ACCOUNTS.reduce(
      (acc, { amount }) => acc.add(web3.utils.toBN(amount)),
      web3.utils.toBN(0)
    );

    // deposit
    console.log("Depositing " + totalAmount);
    switch (deploymentOptions.asset) {
      case "Token":
        IexecInterfaceInstance = await IexecInterfaceToken.at(
          IexecProxyInstance.address
        );
        const RLCInstance = await RLC.deployed();
        await RLCInstance.approveAndCall(
          IexecInterfaceInstance.address,
          totalAmount,
          "0x"
        );
        break;
      case "Native":
        IexecInterfaceInstance = await IexecInterfaceNative.at(
          IexecProxyInstance.address
        );
        await IexecInterfaceInstance.deposit({
          from: accounts[0],
          value: totalAmount.mul(web3.utils.toBN(10 ** 9)),
        });
        break;
    }

    // all transfers
    for (account of ACCOUNTS) {
      const { address, amount } = account
      console.log("Transferring for address " + address + ": " + amount);
      await IexecInterfaceInstance.transfer(address, amount);
    }
  }
};
