//inspired by to https://gist.github.com/inovizz/1fdc2af0182584b90008e0cf2895554c
const fs = require("fs-extra");
const solc = require('solc');
const Promise = require('bluebird');
let Web3 = require('web3');
var contract = require("truffle-contract");
var replace = require("replace");

const readFileAsync = Promise.promisify(fs.readFile);
const copyAsync = Promise.promisify(fs.copy);
const removeAsync = Promise.promisify(fs.remove);

const RLCArtifacts = require('./build/contracts/RLC.json');
const RLCContract = contract(RLCArtifacts);
const WorkerPoolHubArtifacts = require('./build/contracts/WorkerPoolHub.json');
const WorkerPoolHubContract = contract(WorkerPoolHubArtifacts);
const AppHubArtifacts = require('./build/contracts/AppHub.json');
const AppHubContract = contract(AppHubArtifacts);
const DatasetHubArtifacts = require('./build/contracts/DatasetHub.json');
const DatasetHubContract = contract(DatasetHubArtifacts);
const TaskRequestHubArtifacts = require('./build/contracts/TaskRequestHub.json');
const TaskRequestHubContract = contract(TaskRequestHubArtifacts);
const IexecHubArtifacts = require('./build/contracts/IexecHub.json');
const IexecHubContract = contract(IexecHubArtifacts);



const amountGazProvided = 5900000;
const FETCH_INTERVAL = 1000;
const TIMEOUT = 60 * 1000;
const sleep = ms => new Promise(res => setTimeout(res, ms));

let web3 = new Web3();
let provider = new Web3.providers.HttpProvider("http://localhost:8545");
web3.setProvider(provider);

Promise.promisifyAll(web3.eth);

let marketplaceCreator = web3.eth.coinbase;

async function cleanSolcDirectory() {
  try {
    await removeAsync('solc');
    console.log('clean success!')
  } catch (err) {
    console.error(err)
  }
};

async function copyContracts() {
  try {
    await Promise.all([
      copyAsync('contracts', 'solc'),
      copyAsync('node_modules/rlc-token/contracts/RLC.sol', 'solc/RLC.sol'),
      copyAsync('node_modules/rlc-token/contracts/Ownable.sol', 'solc/Ownable.sol'),
      copyAsync('node_modules/rlc-token/contracts/SafeMath.sol', 'solc/SafeMath.sol'),
      copyAsync('node_modules/rlc-token/contracts/ERC20.sol', 'solc/ERC20.sol'),
      copyAsync('node_modules/rlc-token/contracts/TokenSpender.sol', 'solc/TokenSpender.sol'),
    ]);
    replace({
      regex: "rlc-token/contracts/RLC.sol",
      replacement: "./RLC.sol",
      paths: ['solc'],
      recursive: true,
      silent: true,
    });
    console.log('copy contracts success!')
  } catch (err) {
    console.error(err)
  }
};


const waitFor = async(fn, hash, gasLimit) => {
  let counter = 0;
  try {
    const txReceipt = await fn(hash);
    if (counter < TIMEOUT && txReceipt === null) {
      await sleep(FETCH_INTERVAL);
      counter += FETCH_INTERVAL;
      return waitFor(fn, hash);
    } else if (counter > TIMEOUT) {
      throw Error('TIMEOUT: Transaction still not included in a Block');
    }
    if (txReceipt.cumulativeGasUsed && txReceipt.cumulativeGasUsed === gasLimit) {
      throw Error('ALL GAS USED: Transaction has throw');
    }
    return txReceipt;
  } catch (error) {
    console.error('waitFor()' + error);
    throw error;
  }
};

async function deployRLC(compiledContract) {
  try {
    let abi = compiledContract.contracts['RLC.sol:RLC'].interface;
    let bytecode = '0x' + compiledContract.contracts['RLC.sol:RLC'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new({
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    RLCContract.setProvider(web3.currentProvider);
    return RLCContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function deployWorkerPoolHub(compiledContract) {
  try {
    let abi = compiledContract.contracts['WorkerPoolHub.sol:WorkerPoolHub'].interface;
    let bytecode = '0x' + compiledContract.contracts['WorkerPoolHub.sol:WorkerPoolHub'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new({
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    WorkerPoolHubContract.setProvider(web3.currentProvider);
    return WorkerPoolHubContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function deployAppHub(compiledContract) {
  try {
    let abi = compiledContract.contracts['AppHub.sol:AppHub'].interface;
    let bytecode = '0x' + compiledContract.contracts['AppHub.sol:AppHub'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new({
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    AppHubContract.setProvider(web3.currentProvider);
    return AppHubContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function deployDatasetHub(compiledContract) {
  try {
    let abi = compiledContract.contracts['DatasetHub.sol:DatasetHub'].interface;
    let bytecode = '0x' + compiledContract.contracts['DatasetHub.sol:DatasetHub'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new({
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    DatasetHubContract.setProvider(web3.currentProvider);
    return DatasetHubContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function deployTaskRequestHub(compiledContract) {
  try {
    let abi = compiledContract.contracts['TaskRequestHub.sol:TaskRequestHub'].interface;
    let bytecode = '0x' + compiledContract.contracts['TaskRequestHub.sol:TaskRequestHub'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new({
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    TaskRequestHubContract.setProvider(web3.currentProvider);
    return TaskRequestHubContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function deployIexecHub(compiledContract, tokenAddress, workerPoolHubAddress, appHubAddress, datasetHubAddress, taskRequestHubAddress) {
  try {
    let abi = compiledContract.contracts['IexecHub.sol:IexecHub'].interface;
    let bytecode = '0x' + compiledContract.contracts['IexecHub.sol:IexecHub'].bytecode;
    let MyContract = web3.eth.contract(JSON.parse(abi));
    var created = await MyContract.new(tokenAddress, workerPoolHubAddress, appHubAddress, datasetHubAddress, taskRequestHubAddress, {
      from: marketplaceCreator,
      data: bytecode,
      gas: amountGazProvided
    });
    const txReceipt = await waitFor(web3.eth.getTransactionReceiptAsync, created.transactionHash);
    IexecHubContract.setProvider(web3.currentProvider);
    return IexecHubContract.at(txReceipt.contractAddress);
  } catch (err) {
    console.error(err)
  }
};

async function compileAndDeploy() {

  await cleanSolcDirectory();
  await copyContracts();
  var input = {
    'OwnableOZ.sol': fs.readFileSync('./solc/OwnableOZ.sol', 'utf8'),
    'SafeMathOZ.sol': fs.readFileSync('./solc/SafeMathOZ.sol', 'utf8'),
    'IexecHubInterface.sol': fs.readFileSync('./solc/IexecHubInterface.sol', 'utf8'),
    'IexecHubAccessor.sol': fs.readFileSync('./solc/IexecHubAccessor.sol', 'utf8'),
    'AuthorizedList.sol': fs.readFileSync('./solc/AuthorizedList.sol', 'utf8'),
    'App.sol': fs.readFileSync('./solc/App.sol', 'utf8'),
    'AppHub.sol': fs.readFileSync('./solc/AppHub.sol', 'utf8'),
    'WorkerPool.sol': fs.readFileSync('./solc/WorkerPool.sol', 'utf8'),
    'WorkerPoolHub.sol': fs.readFileSync('./solc/WorkerPoolHub.sol', 'utf8'),
    'Contributions.sol': fs.readFileSync('./solc/Contributions.sol', 'utf8'),
    'Dataset.sol': fs.readFileSync('./solc/Dataset.sol', 'utf8'),
    'DatasetHub.sol': fs.readFileSync('./solc/DatasetHub.sol', 'utf8'),
    'TaskRequest.sol': fs.readFileSync('./solc/TaskRequest.sol', 'utf8'),
    'TaskRequestHub.sol': fs.readFileSync('./solc/TaskRequestHub.sol', 'utf8'),
    'TokenSpender.sol': fs.readFileSync('./solc/TokenSpender.sol', 'utf8'),
    'Ownable.sol': fs.readFileSync('./solc/Ownable.sol', 'utf8'),
    'SafeMath.sol': fs.readFileSync('./solc/SafeMath.sol', 'utf8'),
    'ERC20.sol': fs.readFileSync('./solc/ERC20.sol', 'utf8'),
    'RLC.sol': fs.readFileSync('./solc/RLC.sol', 'utf8'),
    'IexecAPI.sol': fs.readFileSync('./solc/IexecAPI.sol', 'utf8'),
    'IexecHub.sol': fs.readFileSync('./solc/IexecHub.sol', 'utf8')
  };

  // console.log(input);
  console.log("compiling contracts ...");

  let compiledContract = solc.compile({
    sources: input
  }, 1);
  //console.log(compiledContract);
  console.log("deploying contracts ...");
  //RLC
  let aRLCInstance = await deployRLC(compiledContract);
  console.log("RLC            : " + aRLCInstance.address);

  let txReceipt = await aRLCInstance.unlock({
    from: marketplaceCreator,
    gas: amountGazProvided
  });
  //  console.log("RLC unlocked");


  //WorkerPoolHub
  let aWorkerPoolHubInstance = await deployWorkerPoolHub(compiledContract);
  console.log("WorkerPoolHub  : " + aWorkerPoolHubInstance.address);

  //AppHub
  let aAppHubInstance = await deployAppHub(compiledContract);
  console.log("AppHub         : " + aAppHubInstance.address);

  //DatasetHub
  let aDatasetHubInstance = await deployDatasetHub(compiledContract);
  console.log("DatasetHub     : " + aDatasetHubInstance.address);

  //TaskRequestHub
  let aTaskRequestHubInstance = await deployTaskRequestHub(compiledContract);
  console.log("TaskRequestHub : " + aTaskRequestHubInstance.address);

  //IexecHub
  let aIexecHubInstance = await deployIexecHub(compiledContract, aRLCInstance.address, aWorkerPoolHubInstance.address, aAppHubInstance.address, aDatasetHubInstance.address, aTaskRequestHubInstance.address);
  console.log("IexecHub       : " + aIexecHubInstance.address);

  await aWorkerPoolHubInstance.transferOwnership(aIexecHubInstance.address, {
    from: marketplaceCreator,
    gas: amountGazProvided
  });
  console.log("transferOwnership of WorkerPoolHub to IexecHub");

  await aAppHubInstance.transferOwnership(aIexecHubInstance.address, {
    from: marketplaceCreator,
    gas: amountGazProvided
  });
  console.log("transferOwnership of AppHub to IexecHub");

  await aDatasetHubInstance.transferOwnership(aIexecHubInstance.address, {
    from: marketplaceCreator,
    gas: amountGazProvided
  });
  console.log("transferOwnership of DatasetHub to IexecHub");

  await aTaskRequestHubInstance.transferOwnership(aIexecHubInstance.address, {
    from: marketplaceCreator,
    gas: amountGazProvided
  });
  console.log("transferOwnership of TaskRequestHub to IexecHub");

}

compileAndDeploy();
