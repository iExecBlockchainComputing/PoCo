const Promise = require('bluebird');
const Web3 = require('web3');
const fs = require('fs-extra');
const openAsync = Promise.promisify(fs.open);
const writeAsync = Promise.promisify(fs.write);
const readFileAsync = Promise.promisify(fs.readFile);
const writeFileAsync = Promise.promisify(fs.writeFile);

const Extensions = require("../../../utils/extensions.js");

var MSG_SENDER = process.argv[2] || "0x8bd535d49b095ef648cd85ea827867d358872809";
var SMART_CONTRACT_ADDRESS = process.argv[3] || "0xeae99b010f8b8852ab47ba883f4c5157633c5ac6";
var NODE_TARGET = process.argv[3] || "http://localhost:8545";

web3 = new Web3(new Web3.providers.HttpProvider(NODE_TARGET));
//wait for infura to do this to replace our test node .
//https://github.com/INFURA/infura/issues/13
Promise.promisifyAll(web3.eth,     { suffix: "Promise" });
Promise.promisifyAll(web3.version, { suffix: "Promise" });
Promise.promisifyAll(web3.evm,     { suffix: "Promise" });

Extensions.init(web3, assert);
var constants = require("../../constants");

async function getAbiContent() {
  try {
    var abiFileContent = await readFileAsync("../../deployed/contracts/IexecAPI.json");
    return JSON.parse(abiFileContent);
  } catch (err) {
    console.error(err)
  }
};


async function run() {
  try {

    var abiJson = await getAbiContent();
    var aIexecAPIInstance = web3.eth.contract(abiJson.abi).at(SMART_CONTRACT_ADDRESS);


    var marketorderIdx=2;
    var workerpool="0xecb64b809257138dbedc41d45bde27fa323016a2";
    var app="0x88f29bef874957012ed55fd4968c296c9e4ec69e";
    var dataset="0x0000000000000000000000000000000000000000";
    var params="ace";
    var callback='0xeae99b010f8b8852ab47ba883f4c5157633c5ac6';//IexecAPI contract
    //var callback="0x0000000000000000000000000000000000000000";
    var beneficiary=MSG_SENDER;

    aIexecAPIInstance.buyForWorkOrder.sendTransaction(marketorderIdx,workerpool,app,dataset,params,callback,beneficiary,
      {
          from: MSG_SENDER,
          gas: '4400000',
          gasPrice: '120000000000'
        },
        function(error, result){
        if(!error) {
            console.log(result)
        } else {
            console.error("error");
            console.error(error);
        }
    });

    var events = await Extensions.getEventsPromise(aIexecAPIInstance.WorkOrderActivated({}),1,constants.EVENT_WAIT_TIMEOUT);
    console.log("events");
    console.log(events);
    console.log("woid");
    console.log(events[0].args.woid);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
