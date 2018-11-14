const Promise = require('bluebird');
const Web3 = require('web3');
const fs = require('fs-extra');
const openAsync = Promise.promisify(fs.open);
const writeAsync = Promise.promisify(fs.write);
const readFileAsync = Promise.promisify(fs.readFile);
const writeFileAsync = Promise.promisify(fs.writeFile);

var MSG_SENDER = process.argv[2] || "0x8bd535d49b095ef648cd85ea827867d358872809";
var SMART_CONTRACT_ADDRESS = process.argv[3] || "0x9d32b7cbfa9d68f04048589e5c9cefda241c6312";
var NODE_TARGET = process.argv[3] || "http://localhost:8545";

web3 = new Web3(new Web3.providers.HttpProvider(NODE_TARGET));

Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});

async function getAbiContent() {
  try {
    var abiFileContent = await readFileAsync("../../deployed/contracts/Marketplace.json");
    return JSON.parse(abiFileContent).abi;
  } catch (err) {
    console.error(err)
  }
};

async function run() {
  try {
    var abi = await getAbiContent();
    var abiString =JSON.stringify(abi);
    var contract = new web3.eth.Contract(JSON.parse(abiString), SMART_CONTRACT_ADDRESS);

    web3.eth.getTransactionCountPromise(MSG_SENDER).timeout(2000).then(function(currentNonce) {
      console.log("MSG_SENDER [" + MSG_SENDER + "] nonce is [" + currentNonce + "]");
      try {
        contract.methods.isCallbackDone('0x5dcde002af0ab18d4882c28d8be7719323b4acfd'/*woid*/).call({from: '0x8bd535d49b095ef648cd85ea827867d358872809'}, function(error, result){
          console.debug("isCallbackDone for 0x5dcde002af0ab18d4882c28d8be7719323b4acfd: " );
          console.debug(result);
        });

      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
