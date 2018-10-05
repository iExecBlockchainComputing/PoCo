var RLC          = artifacts.require("../node_modules/rlc-token//contracts/RLC.sol");
var IexecHub     = artifacts.require("./IexecHub.sol");
var IexecClerk   = artifacts.require("./IexecClerk.sol");
var DappRegistry = artifacts.require("./DappRegistry.sol");
var DataRegistry = artifacts.require("./DataRegistry.sol");
var PoolRegistry = artifacts.require("./PoolRegistry.sol");
var Dapp         = artifacts.require("./Dapp.sol");
var Data         = artifacts.require("./Data.sol");
var Pool         = artifacts.require("./Pool.sol");
var Beacon       = artifacts.require("./Beacon.sol");
var Broker       = artifacts.require("./Broker.sol");

const ethers    = require("ethers"); // for ABIEncoderV2
const constants = require("../constants");
const odbtools  = require("../../utils/odb-tools");


contract("IexecHub", async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin    = accounts[0];
	let dappProvider  = accounts[1];
	let dataProvider  = accounts[2];
	let poolScheduler = accounts[3];
	let poolWorker1   = accounts[4];
	let poolWorker2   = accounts[5];
	let poolWorker3   = accounts[6];
	let poolWorker4   = accounts[7];
	let user          = accounts[8];
	let sgxEnclave    = accounts[9];

	var IexecClerkEthersInstance = null;

	verifyDappOrder = async dapporder => IexecClerkEthersInstance.verify(await (await Dapp.at(dapporder.dapp)).m_owner(), odbtools.DappOrderStructHash(dapporder), dapporder.sign);
	verifyDataOrder = async dataorder => IexecClerkEthersInstance.verify(await (await Data.at(dataorder.data)).m_owner(), odbtools.DataOrderStructHash(dataorder), dataorder.sign);
	verifyPoolOrder = async poolorder => IexecClerkEthersInstance.verify(await (await Pool.at(poolorder.pool)).m_owner(), odbtools.PoolOrderStructHash(poolorder), poolorder.sign);
	verifyUserOrder = async userorder => IexecClerkEthersInstance.verify(userorder.requester,                             odbtools.UserOrderStructHash(userorder), userorder.sign);

	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		jsonRpcProvider          = new ethers.providers.JsonRpcProvider();
		IexecClerkEthersInstance = new ethers.Contract("0xBfBfD8ABc99fA00Ead2C46879A7D06011CbA73c5", IexecClerk.abi, jsonRpcProvider);

		odbtools.setup({
			name:              "iExecODB",
			version:           "3.0-alpha",
			chainId:           26,
			verifyingContract: IexecClerkEthersInstance.address,
		});
	});

	dapporder = {"dapp":"0x385fFe1c9Ec3d6a0798eD7a13445Cb2B2de9fd09","dappprice":300000000,"volume":1000,"datarestrict":"0x0000000000000000000000000000000000000000","poolrestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0x1e7479c72c0620c799876a4ed3c7b2bd","sign":{"r":"0xef2d340a825a646dfe67615c91f98f054cb7a1fa26c7f3d9cfcd64bb8abdc027","s":"0x051c738d647dd6229b77e1e028c151bf10e0f0ab9cf61c71044c1a7290dffa6d","v":28}}
	dataorder = {"data":"0x82D7300c32daFcF6bfdFcf53a2aeDfEF1D6C3415","dataprice":100000000,"volume":1000,"dapprestrict":"0x0000000000000000000000000000000000000000","poolrestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0x804733892ca9caa586128674d5b56def","sign":{"r":"0xcc9193bb0c98f3cebba35a5907f560a171e4cb6e75e9943077419a6432bc9248","s":"0x3701bf68d382e600a6ed930e6a5d84cf5c489aff41ff83069536cfd01847ff31","v":27}}
	poolorder = {"pool":"0xd69663e2263C7D8002500361C742de967Ca488e2","poolprice":2500000000,"volume":3,"category":4,"trust":1000,"tag":0,"dapprestrict":"0x0000000000000000000000000000000000000000","datarestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0x9f5f421b61254fef5056eef8c17b23c1","sign":{"r":"0xd5dc46e61e1fd24d0d96b42350d9dc410f393bfbf7c919013f47b3847ed4180b","s":"0x53045863083dcac41a181f385d78438d9e62f612e58674843841a01c5da0658e","v":28}}
	userorder = {"dapp":"0x270d4754925D371bCD06E64ED6F541d9db88D64c","dappmaxprice":1000000000,"data":"0x84dF4B4e219967F3f5ad93ee73fDE7197fff5b11","datamaxprice":1000000000,"pool":"0x0000000000000000000000000000000000000000","poolmaxprice":5000000000,"volume":1,"category":4,"trust":1000,"tag":0,"requester":"0x0ad5797Bc72F14430e4887c2bc6F9b478107b9d3","beneficiary":"0x0ad5797Bc72F14430e4887c2bc6F9b478107b9d3","callback":"0x0000000000000000000000000000000000000000","params":"<parameters>","salt":"0x474d00107c39c650c14d594d6ef61b4e","sign":{"r":"0xf65ef84388c443f2a6cea2c6ef2fa151e3be48211ddfe7958958ce72a709090f","s":"0x19e0e6209bf73a93aa80ffd743c4b07fc7624d85b918dabd50d3a20f42b6c945","v":27}}

	it("verifyDappOrder", async () => assert(await verifyDappOrder(dapporder)));
	it("verifyDataOrder", async () => assert(await verifyDataOrder(dataorder)));
	it("verifyPoolOrder", async () => assert(await verifyPoolOrder(poolorder)));
	it("verifyUserOrder", async () => assert(await verifyUserOrder(userorder)));

});
