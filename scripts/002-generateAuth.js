var RLC                = artifacts.require("../node_modules/rlc-faucet-contract/contracts/RLC.sol");
var IexecHub           = artifacts.require("./IexecHub.sol");
var IexecClerk         = artifacts.require("./IexecClerk.sol");
var AppRegistry        = artifacts.require("./AppRegistry.sol");
var DatasetRegistry    = artifacts.require("./DatasetRegistry.sol");
var WorkerpoolRegistry = artifacts.require("./WorkerpoolRegistry.sol");
var App                = artifacts.require("./App.sol");
var Dataset            = artifacts.require("./Dataset.sol");
var Workerpool         = artifacts.require("./Workerpool.sol");
var Relay              = artifacts.require("./Relay.sol");
var Broker             = artifacts.require("./Broker.sol");

const { assert } = require('chai');

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

function toRLC(rlc) { return rlc*10**9; }

var iexecAdmin      = null;
var sgxEnclave      = null;
var appProvider     = null;
var datasetProvider = null;
var scheduler       = null;
var worker1         = null;
var worker2         = null;
var worker3         = null;
var worker4         = null;
var worker5         = null;
var user            = null;

module.exports = async function(callback) {
	try
	{
		console.log("# web3 version:", web3.version);
		console.log("ChainId:  ", await web3.eth.net.getId());
		console.log("ChainType:", await web3.eth.net.getNetworkType());

		var IexecClerkInstance         = await IexecClerk.at("0x8BE59dA9Bf70e75Aa56bF29A3e55d22e882F91bA");
		var RLCInstance                = await RLC.at(await IexecClerkInstance.token());
		var IexecHubInstance           = await IexecHub.at(await IexecClerkInstance.iexechub());
		var AppRegistryInstance        = await AppRegistry.at(await IexecHubInstance.appregistry());
		var DatasetRegistryInstance    = await DatasetRegistry.at(await IexecHubInstance.datasetregistry());
		var WorkerpoolRegistryInstance = await WorkerpoolRegistry.at(await IexecHubInstance.workerpoolregistry());

		console.log("IexecClerk:        ", IexecClerkInstance.address        );
		console.log("RLC:               ", RLCInstance.address               );
		console.log("IexecHub:          ", IexecHubInstance.address          );
		console.log("AppRegistry:       ", AppRegistryInstance.address       );
		console.log("DatasetRegistry:   ", DatasetRegistryInstance.address   );
		console.log("WorkerpoolRegistry:", WorkerpoolRegistryInstance.address);

		web3.eth.getAccounts(function(err, accounts) {
			assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
			iexecAdmin      = accounts[0];
			sgxEnclave      = accounts[0];
			appProvider     = accounts[1];
			datasetProvider = accounts[2];
			scheduler       = accounts[3];
			worker1         = accounts[4];
			worker2         = accounts[5];
			worker3         = accounts[6];
			worker4         = accounts[7];
			worker5         = accounts[8];
			user            = accounts[9];
		});

		enclave = "0x6CDC0e0C0c7b8f409c3ad6734C23677973CA56A3";
		dealid  = "0x8b2fcc39dd5348cc5073840693aa5cdac5bea7434549469a4748eda4664a7ba8",
		taskid  = web3.utils.soliditySha3({ t: 'bytes32', v: dealid }, { t: 'uint256', v: 0 });

		if ((await IexecHubInstance.viewTask(taskid)).status == 0)
		{
			await IexecHubInstance.initialize(dealid, 0, { from: scheduler });
		}

		authorization = {
			worker:  worker1,
			taskid:  taskid,
			enclave: enclave,
		};

		signature = await web3.eth.sign(web3.utils.soliditySha3(
			{ t: 'address', v: authorization.worker  },
			{ t: 'bytes32', v: authorization.taskid  },
			{ t: 'address', v: authorization.enclave },
		), scheduler)

		authorization.sign = {
			r:             "0x" + signature.substr( 2, 64),
			s:             "0x" + signature.substr(66, 64),
			v: 27 + Number("0x" + signature.substr(    -2)),
		}

		console.log("=== authorization ===")
		console.log(authorization)

		Kb = "abcde"
		console.log("=== beneficiary ===")
		console.log(user)
		signature = await web3.eth.sign(Kb, user)
		console.log({ 'sign': signature, 'secret': Kb })

		Kd = "abcdef"
		console.log("=== dataset ===")
		signature = await web3.eth.sign(Kd, datasetProvider)
		console.log(datasetProvider)
		console.log({ 'sign': signature, 'secret': Kd })
	}
	catch (e)
	{
		callback(e)
	}
	finally
	{
		callback()
	}
}
