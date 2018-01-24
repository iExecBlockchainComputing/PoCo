var TestSha = artifacts.require("./TestSha.sol");

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



  let scheduler, worker, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser, universalCreator;
  let amountGazProvided = 4000000;
  let isTestRPC;
  let testTimemout = 0;
  let aTestShaInstance;


  before("should prepare accounts and check TestRPC Mode", function() {
    assert.isAtLeast(accounts.length, 8, "should have at least 8 accounts");
    scheduler = accounts[0];
    worker = accounts[1];
    appProvider = accounts[2];
    datasetProvider = accounts[3];
    dappUser = accounts[4];
    dappProvider = accounts[5];
    iExecCloudUser = accounts[6];
    universalCreator = accounts[7];


    return Extensions.makeSureAreUnlocked(
        [scheduler, worker, appProvider, datasetProvider, dappUser, dappProvider, iExecCloudUser])
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
      .then(() => Extensions.refillAccount(scheduler, universalCreator, 10))
      .then(() => web3.version.getNodePromise())
      .then(node => isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0)
      .then(() => TestSha.new({
        from: universalCreator
      }))
      .then(instance => {
        aTestShaInstance = instance;
        console.log("aTestShaInstance.address is ");
        console.log(aTestShaInstance.address);
      });
  });

  it("testSolidityKeccak256FromString", function() {
    return aTestShaInstance.testSolidityKeccak256FromString("0x2ef06b8bbad022ca2dd29795902ceb588d06d1cfd10cb6e687db0dbb837865e9")
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aTestShaInstance.SolidityKeccak256FromString({}));
      })
      .then(events => {
        assert.strictEqual(events[0].args.result, "0x19e98db1bba2bcfa5173878f361558fba623f8e8234428e15ee08f4a3eab2fc2", "check result");
        assert.strictEqual(events[0].args.result, web3.sha3("0x2ef06b8bbad022ca2dd29795902ceb588d06d1cfd10cb6e687db0dbb837865e9"), "check input");
        assert.strictEqual(events[0].args.input, "0x2ef06b8bbad022ca2dd29795902ceb588d06d1cfd10cb6e687db0dbb837865e9", "check input");
      });
  });

  it("testSolidityKeccak256FromBytes", function() {
    return aTestShaInstance.testSolidityKeccak256FromBytes("0x2ef06b8bbad022ca2dd29795902ceb588d06d1cfd10cb6e687db0dbb837865e9")
      .then(txMined => {
        assert.isBelow(txMined.receipt.gasUsed, amountGazProvided, "should not use all gas");
        return Extensions.getEventsPromise(aTestShaInstance.SolidityKeccak256FromBytes({}));
      })
      .then(events => {
        assert.strictEqual(events[0].args.result, "0x7923f91d6a87840a7cede996606501768bbe2cdfdd34b8d6b193de881b867aed", "check result. is the same as web3java !!!");
        assert.strictEqual(events[0].args.input, "0x2ef06b8bbad022ca2dd29795902ceb588d06d1cfd10cb6e687db0dbb837865e9", "check input");
      });
  });


});
