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
  //deploy(IexecAPI,IexecHub,Marketplace)
  return deployer.deploy(IexecAPI, '0x12b92a17b1ca4bb10b861386446b8b2716e58c9b', '0x9315a6ae9a9842bcb5ad8f5d43a4271d297088e2')
    .then(() => IexecAPI.deployed())
    .then(instance => {
      aIexecAPIInstance = instance;
      console.log("IexecAPI deployed at address: " + instance.address);
    })
};
