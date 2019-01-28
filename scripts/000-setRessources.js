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

		assert.equal(await RLCInstance.owner(), iexecAdmin, "iexecAdmin should own the RLC smart contract");

		await Promise.all([
			RLCInstance.transfer(appProvider,     toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(datasetProvider, toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(scheduler,       toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(worker1,         toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(worker2,         toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(worker3,         toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(worker4,         toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(worker5,         toRLC(100), { from: iexecAdmin }),
			RLCInstance.transfer(user,            toRLC(100), { from: iexecAdmin }),
		]);

		await Promise.all([
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: appProvider     }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: datasetProvider }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: scheduler       }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: worker1         }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: worker2         }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: worker3         }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: worker4         }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: worker5         }),
			RLCInstance.approve(IexecClerkInstance.address, toRLC(100), { from: user            }),
		]);

		await Promise.all([
			IexecClerkInstance.deposit(toRLC(100), { from: appProvider     }),
			IexecClerkInstance.deposit(toRLC(100), { from: datasetProvider }),
			IexecClerkInstance.deposit(toRLC(100), { from: scheduler       }),
			IexecClerkInstance.deposit(toRLC(100), { from: worker1         }),
			IexecClerkInstance.deposit(toRLC(100), { from: worker2         }),
			IexecClerkInstance.deposit(toRLC(100), { from: worker3         }),
			IexecClerkInstance.deposit(toRLC(100), { from: worker4         }),
			IexecClerkInstance.deposit(toRLC(100), { from: worker5         }),
			IexecClerkInstance.deposit(toRLC(100), { from: user            }),
		]);

		// APP
		var appaddress = await AppRegistryInstance.viewEntry(appProvider, 1);
		if (appaddress == "0x0000000000000000000000000000000000000000")
		{
			txMined = await AppRegistryInstance.createApp(
				appProvider,
				"myApp",
				"None",
				"0x0", // multiaddr
				"0x0", // checksum
				"0x",  // mrenclave
				{ from: appProvider }
			);
			events = extractEvents(txMined, AppRegistryInstance.address, "CreateApp");
			appaddress = events[0].args.app;
		}
		console.log("--");
		console.log("[App]");
		console.log("address:", appaddress);
		console.log("owner:", appProvider);

		// DATASET
		var datasetaddress = await DatasetRegistryInstance.viewEntry(datasetProvider, 1);
		if (datasetaddress == "0x0000000000000000000000000000000000000000")
		{
			txMined = await DatasetRegistryInstance.createDataset(
				datasetProvider,
				"myDataset",
				"0x0", // multiaddr
				"0x0", // checksum
				{ from: datasetProvider }
			);
			events = extractEvents(txMined, DatasetRegistryInstance.address, "CreateDataset");
			datasetaddress = events[0].args.dataset;
		}
		console.log("--");
		console.log("[Dataset]");
		console.log("address:", datasetaddress);
		console.log("owner:", datasetProvider);

		// WORKERPOOL
		var workerpooladdress = await WorkerpoolRegistryInstance.viewEntry(scheduler, 1);
		if (workerpooladdress == "0x0000000000000000000000000000000000000000")
		{
			txMined = await WorkerpoolRegistryInstance.createWorkerpool(
				scheduler,
				"A test workerpool",
				{ from: scheduler }
			);
			events = extractEvents(txMined, WorkerpoolRegistryInstance.address, "CreateWorkerpool");
			workerpooladdress = events[0].args.workerpool;
		}
		console.log("--");
		console.log("[Workerpool]");
		console.log("address:", workerpooladdress);
		console.log("owner:", scheduler);
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
