var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");

const Promise = require("bluebird");
//extensions.js : credit to : https://github.com/coldice/dbh-b9lab-hackathon/blob/development/truffle/utils/extensions.js
const Extensions = require("../utils/extensions.js");
const addEvmFunctions = require("../utils/evmFunctions.js");
addEvmFunctions(web3);
Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.version, {
  suffix: "Promise"
});
Promise.promisifyAll(web3.evm, {
  suffix: "Promise"
});
Extensions.init(web3, assert);

contract('IexecHub', function(accounts) {

  var dappProvider, dappUser, bridge, rlcCreator;
  var amountGazProvided = 4000000;
  let isTestRPC;
  let testTimemout = 0;
  let aRLCInstance;
  let aIexecOracleEscrowInstance;
  let aFfmpegInstance;


  before("should prepare accounts and check TestRPC Mode", function() {
    assert.isAtLeast(accounts.length, 8, "should have at least 8 accounts");
    scheduler = accounts[0];
    worker = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    rlcCreator = accounts[7];

    return Extensions.makeSureAreUnlocked(
        [scheduler, worker, appProvider, datasetProvider, dappUser, dappProvider,iExecCloudUser])
      .then(() => web3.eth.getBalancePromise(scheduler))
      .then(balance => assert.isTrue(
        web3.toWei(web3.toBigNumber(80), "ether").lessThan(balance),
        "dappProvider should have at least 80 ether, not " + web3.fromWei(balance, "ether")))
      .then(() => Extensions.refillAccount(scheduler, worker, 10))
      .then(() => Extensions.refillAccount(scheduler, appProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, datasetProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, dappUser, 10))
      .then(() => Extensions.refillAccount(scheduler, dappProvider, 10))
      .then(() => Extensions.refillAccount(scheduler, iExecCloudUser, 10))
      .then(() => Extensions.refillAccount(scheduler, rlcCreator, 10))
      .then(() => web3.version.getNodePromise())
      .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0)
      .then(() => {
        return RLC.new({
          from: rlcCreator,
          gas: amountGazProvided
        });
      })
      .then(instance => {
        aRLCInstance = instance;
        console.log("aRLCInstance.address is ");
        console.log(aRLCInstance.address);
        return aRLCInstance.unlock({
          from: rlcCreator,
          gas: amountGazProvided
        });
      })
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
      });
  });

  it("Geth mode example : test only launch when geth is used", function() {
    if (isTestRPC) this.skip("This test is only for geth");
  });

  it("TestRPC mode example : test only launch when testrpc is used", function() {
    if (!isTestRPC) this.skip("This test is only for TestRPC");
  });


});
