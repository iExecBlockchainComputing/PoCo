var IexecHub = artifacts.require("./IexecHub.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
var AppHub = artifacts.require("./AppHub.sol");
var DatasetHub = artifacts.require("./DatasetHub.sol");
var Marketplace = artifacts.require("./Marketplace.sol");
var RLC = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecAPI = artifacts.require("./IexecAPI.sol");

const fs = require("fs-extra");
const Promise = require("bluebird");
const readFileAsync = Promise.promisify(fs.readFile);
/**


**/
module.exports = function(deployer) {
  let aIexecAPIInstance;;
  return deployer.deploy(IexecAPI, '0xc4e4a08bf4c6fd11028b714038846006e27d7be8', '0x9d32b7cbfa9d68f04048589e5c9cefda241c6312', {
      from: '0x8bd535d49b095ef648cd85ea827867d358872809',
      gas: '4685012'
    })
    .then(() => IexecAPI.deployed())
    .then(instance => {
      aIexecAPIInstance = instance;
      console.log("IexecAPI deployed at address: " + instance.address);
    })
};
