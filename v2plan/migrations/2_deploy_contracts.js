var Poco = artifacts.require("./Poco.sol");
var WorkerPoolHub = artifacts.require("./WorkerPoolHub.sol");
/*
module.exports = function(deployer) {
  return deployer.deploy(Poco, '0x607F4C5BB672230e8672085532f7e901544a7375') //RLC TOKEN ADRESS
    .then(() => Poco.deployed())
    .then(instance => {
      console.log("Poco deployed at address :" + instance.address);
    });
};
*/

module.exports = function(deployer) {
  let aWorkerPoolHubInstance;
  let aPoco;
  return deployer.deploy(WorkerPoolHub) //RLC TOKEN ADRESS
    .then(() => WorkerPoolHub.deployed())
    .then(instance => {
      aWorkerPoolHubInstance =instance;
      console.log("WorkerPoolHub deployed at address :" + instance.address);
      return deployer.deploy(Poco, '0x607F4C5BB672230e8672085532f7e901544a7375',aWorkerPoolHubInstance.address); //CALL BACK PRICE
    })
    .then(() => Poco.deployed())
    .then(instance => {
      aPoco =instance;
      console.log("Poco deployed at address :" + aPoco.address);
      return aWorkerPoolHubInstance.transferOwnership(aPoco.address);
    })
    .then(() => console.log("transferOwnership of WorkerPoolHub to Poco"));
};


/*
RLC TOKEN address :
kovan   = '0xc57538846ec405ea25deb00e0f9b29a432d53507'
rinkeby = '0xf1e6ad3a7ef0c86c915f0fedf80ed851809bea90'
ropsten = '0x7314dc4d7794b5e7894212ca1556ae8e3de58621'
mainnet = '0x607F4C5BB672230e8672085532f7e901544a7375'
 */
