const Promise = require('bluebird');
const Web3 = require('web3');
const fs = require('fs-extra');
const openAsync = Promise.promisify(fs.open);
const writeAsync = Promise.promisify(fs.write);
const readFileAsync = Promise.promisify(fs.readFile);
const writeFileAsync = Promise.promisify(fs.writeFile);

var MSG_SENDER = process.argv[2] || "0x8bd535d49b095ef648cd85ea827867d358872809";
var IEXECHUB_ADDRESS= process.argv[3] || "0xc4e4a08bf4c6fd11028b714038846006e27d7be8";
var CALLBACKPROOF_ADDRESS= process.argv[4] || "0x9d32b7cbfa9d68f04048589e5c9cefda241c6312";
//poa test :
var NODE_TARGET = process.argv[5] || "http://localhost:8545";




web3 = new Web3(new Web3.providers.HttpProvider(NODE_TARGET));

Promise.promisifyAll(web3.eth, {
  suffix: "Promise"
});

async function getContractJson() {
  try {
    var abiFileContent = await readFileAsync("../../deployed/contracts/IexecAPI.json");
    return JSON.parse(abiFileContent);
  } catch (err) {
    console.error(err)
  }
};

async function run() {
  try {
    var contractJson = await getContractJson();
    var iexecAPIContract = new web3.eth.Contract(contractJson.abi);

    console.log(contractJson.abi);
    console.log(contractJson.bytecode);
    console.log("IEXECHUB_ADDRESS");
    console.log(IEXECHUB_ADDRESS);
    console.log("CALLBACKPROOF_ADDRESS");
    console.log(CALLBACKPROOF_ADDRESS);
    console.log("try deploy:");
    iexecAPIContract.deploy({
        data: contractJson.bytecode,
        arguments: [IEXECHUB_ADDRESS, CALLBACKPROOF_ADDRESS]
    })
    .send({
        from: MSG_SENDER,
        gas: '4710000',
        gasPrice: '22000000000'
    }, function(error, transactionHash){ console.log("error transactionHash") ; console.log(error) ; console.log(transactionHash) })
    .on('error', function(error){ console.log("error") ; console.log(error) })
    .on('transactionHash', function(transactionHash){   console.log("transactionHash");  console.log(transactionHash) })
    .on('receipt', function(receipt){
       console.log(receipt.contractAddress) // contains the new contract address
    })
    .on('confirmation', function(confirmationNumber, receipt){  console.log("confirmation");  console.log(confirmation) })
    .then(function(newContractInstance){
        console.log(newContractInstance.options.address) // instance with the new contract address
    });


  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
