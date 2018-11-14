const Promise = require('bluebird');
const Web3 = require('web3');
const fs = require('fs-extra');
const openAsync = Promise.promisify(fs.open);
const writeAsync = Promise.promisify(fs.write);
const readFileAsync = Promise.promisify(fs.readFile);
const writeFileAsync = Promise.promisify(fs.writeFile);


var TX = process.argv[2] || '0x7e5dbb8378272faa7f3112fee66c9e1f04151fe44cdc574ef937d42210760f78';
var NODE_TARGET = process.argv[3] || "http://localhost:8545";

web3 = new Web3(new Web3.providers.HttpProvider(NODE_TARGET));

Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});


async function run() {
  try {
    console.log("getTransactionReceiptPromise for :"+TX);
    var receipt = await web3.eth.getTransactionReceiptPromise(TX);
    if (receipt == null) {
      console.log("receipt is null");
    } else {
      console.log("receipt");
      console.log(receipt);
      console.log("JSON.stringify(receipt);");
      console.log(JSON.stringify(receipt));
    };
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
