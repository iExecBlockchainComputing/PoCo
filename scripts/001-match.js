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

		assert.equal(await web3.eth.net.getId(), 1544020727674, "hardcoded orders are valid on chainId 1544020727674");

		apporder        = {"app":"0x60c1eBfBEE22687339D1c9Ff4b361cF6727241fF","appprice":1000000000,"volume":1000,"tag":0,"datasetrestrict":"0x0000000000000000000000000000000000000000","workerpoolrestrict":"0x0000000000000000000000000000000000000000","requesterrestrict":"0x0000000000000000000000000000000000000000","salt":"0x6e7ff3825769a0bea63c74223fb1de5d","sign":{"r":"0x25097da60c38d832cfa231ef36e5cd8fd35ce6cb48cd1ca9931d5d8e4430a591","s":"0x36eaeb488c3cc74beea9cec497b94ed575f3edc18a7d3d62542fb8f10941a45b","v":27}}
		datasetorder    = {"dataset":"0x385fFe1c9Ec3d6a0798eD7a13445Cb2B2de9fd09","datasetprice":3000000000,"volume":1000,"tag":0,"apprestrict":"0x0000000000000000000000000000000000000000","workerpoolrestrict":"0x0000000000000000000000000000000000000000","requesterrestrict":"0x0000000000000000000000000000000000000000","salt":"0x2068d366d0c4ef5210339466150f8df6","sign":{"r":"0xef41a064dbbcf3b5af67fec2c4b3dcf91cf94e67ef4fda95d108cdf59816d0a6","s":"0x579303bbe98c1537fadc92783bc195e3f9f12f1a9da5f8b4d33183d4fc602259","v":	28}}
		workerpoolorder = {"workerpool":"0x82D7300c32daFcF6bfdFcf53a2aeDfEF1D6C3415","workerpoolprice":5000000000,"volume":100,"tag":0,"category":5,"trust":10000,"apprestrict":"0x0000000000000000000000000000000000000000","datasetrestrict":"0x0000000000000000000000000000000000000000","requesterrestrict":"0x0000000000000000000000000000000000000000","salt":"0x3f580585803ac6789a986bdb1a275991","sign":{"r":"0xe45f2fd3e374f6dbbe0f0a131c9fe14504ff054d13f7adf613ef83fa5cc1903a","s":"0x54dc277053cf62722e4cfde2fe40531710e33cedeaf9ff044876bb655c5cebfa","v":28}}
		requestorder    = {"app":"0x60c1eBfBEE22687339D1c9Ff4b361cF6727241fF","appmaxprice":1000000000,"dataset":"0x385fFe1c9Ec3d6a0798eD7a13445Cb2B2de9fd09","datasetmaxprice":3000000000,"workerpool":"0x0000000000000000000000000000000000000000","workerpoolmaxprice":10000000000,"volume":1,"tag":0,"category":5,"trust":100,"requester":"0x9a43BB008b7A657e1936ebf5d8e28e5c5E021596","beneficiary":"0x9a43BB008b7A657e1936ebf5d8e28e5c5E021596","callback":"0x0000000000000000000000000000000000000000","params":"{}","salt":"0xefce68489c0b7680bfc1bead006364f8","sign":{"r":"0x007a02215f8a069fc8396799e32de13f1c2b4e6b339721e3e3d43b599da54cea","s":"0x5ae2c7f269b5862fe1dd410aecaa0ff47379c53e4c002358530204d3c593d463","v":28}}

		apporderHash        = "0xeb1e1a9bd8603f31acc3ab11865dd96acb517a803115e6bfcd04b8c9697695c3"
		datasetorderHash    = "0x51f71b957099afc83e5cb86184327b215508297d47d92ad3c4af1b5698cb6eca"
		workerpoolorderHash = "0xd98df224551e36232af0f79e37b6d7fc30aa20f87e004a5ad65f2f2a32d3ace1"
		requestorderHash    = "0x17807e1054fcba507db5240288916c6aed9d3e97041a6c784c263e3167d4f61f"

		assert.equal(await (await App.at       (apporder.app              )).m_owner(), appProvider    );
		assert.equal(await (await Dataset.at   (datasetorder.dataset      )).m_owner(), datasetProvider);
		assert.equal(await (await Workerpool.at(workerpoolorder.workerpool)).m_owner(), scheduler      );
		assert.equal(requestorder.requester,                                            user           );

		assert(await IexecClerkInstance.verify(appProvider,     apporderHash,        apporder.sign,        {}));
		assert(await IexecClerkInstance.verify(datasetProvider, datasetorderHash,    datasetorder.sign,    {}));
		assert(await IexecClerkInstance.verify(scheduler,       workerpoolorderHash, workerpoolorder.sign, {}));
		assert(await IexecClerkInstance.verify(user,            requestorderHash,    requestorder.sign,    {}));

		balance = await IexecClerkInstance.viewAccount(appProvider    ); console.log("balance appProvider:    ", Number(balance.stake), Number(balance.locked));
		balance = await IexecClerkInstance.viewAccount(datasetProvider); console.log("balance datasetProvider:", Number(balance.stake), Number(balance.locked));
		balance = await IexecClerkInstance.viewAccount(scheduler      ); console.log("balance scheduler:      ", Number(balance.stake), Number(balance.locked));
		balance = await IexecClerkInstance.viewAccount(user           ); console.log("balance user:           ", Number(balance.stake), Number(balance.locked));

		console.log("consumed app:       ", Number(await IexecClerkInstance.viewConsumed(apporderHash       )));
		console.log("consumed dataset:   ", Number(await IexecClerkInstance.viewConsumed(datasetorderHash   )));
		console.log("consumed workerpool:", Number(await IexecClerkInstance.viewConsumed(workerpoolorderHash)));
		console.log("consumed request:   ", Number(await IexecClerkInstance.viewConsumed(requestorderHash   )));

		txMined = await IexecClerkInstance.matchOrders(
			apporder,
			datasetorder,
			workerpoolorder,
			requestorder,
			{ from: user }
		);
		events = extractEvents(txMined, IexecClerkInstance.address, "SchedulerNotice");
		console.log("MATCHED!")
		console.log("dealid:             ", events[0].args.dealid,                                            );
		console.log("consumed app:       ", Number(await IexecClerkInstance.viewConsumed(apporderHash       )));
		console.log("consumed dataset:   ", Number(await IexecClerkInstance.viewConsumed(datasetorderHash   )));
		console.log("consumed workerpool:", Number(await IexecClerkInstance.viewConsumed(workerpoolorderHash)));
		console.log("consumed request:   ", Number(await IexecClerkInstance.viewConsumed(requestorderHash   )));
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
