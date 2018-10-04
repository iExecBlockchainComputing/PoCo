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
			chainId:           3,
			verifyingContract: IexecClerkEthersInstance.address,
		});
	});


	it("verifyDappOrder", async () => assert(await verifyDappOrder(
 {"dapp":"0x385fFe1c9Ec3d6a0798eD7a13445Cb2B2de9fd09","dappprice":3,"volume":1000,"datarestrict":"0x0000000000000000000000000000000000000000","poolrestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0xc6b2bac19b2ae3677d1194c673a84ca2","sign":{"r":"0x95aedcf88da698e8827cb4b9f9c923bc42594e887af4c5183e19c52fc1ca1920","s":"0x0dab6a1aec1a289d5acf20993a68a2820766bac24437e47580f9c12f84f549ad","v":27}}
	)));


	it("verifyDataOrder", async () => assert(await verifyDataOrder(
 {"data":"0x82D7300c32daFcF6bfdFcf53a2aeDfEF1D6C3415","dataprice":1,"volume":1000,"dapprestrict":"0x0000000000000000000000000000000000000000","poolrestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0xfe779547a8f282b891e54b320ed7fd07","sign":{"r":"0x5382a9965437d55b8a6755eb9e72934e394b743f37b6a3ace06d95acd1a3d91d","s":"0x5fb0658dd38098ee9bd20aa498611b031ffd5614af5bd0f1f4c410c305412acc","v":28}}
	)));


	it("verifyPoolOrder", async () => assert(await verifyPoolOrder(
 {"pool":"0xd69663e2263C7D8002500361C742de967Ca488e2","poolprice":25,"volume":3,"category":4,"trust":1000,"tag":0,"dapprestrict":"0x0000000000000000000000000000000000000000","datarestrict":"0x0000000000000000000000000000000000000000","userrestrict":"0x0000000000000000000000000000000000000000","salt":"0xe00ddbfa9574aa68fb118c54e9edf10b","sign":{"r":"0xcf66f0edfef4641371a95f25f620086b9823772e239c10fe5cc9846834d3ce70","s":"0x2d2286d8e86a72e833cce62b30fcb846488c4a846986925756a3ede3dc5ef1cb","v":27}}
	)));


	it("verifyUserOrder", async () => assert(await verifyUserOrder(
{"dapp":"0x270d4754925D371bCD06E64ED6F541d9db88D64c","dappmaxprice":3,"data":"0x84dF4B4e219967F3f5ad93ee73fDE7197fff5b11","datamaxprice":1,"pool":"0x0000000000000000000000000000000000000000","poolmaxprice":25,"volume":1,"category":4,"trust":1000,"tag":0,"requester":"0x0ad5797Bc72F14430e4887c2bc6F9b478107b9d3","beneficiary":"0x0ad5797Bc72F14430e4887c2bc6F9b478107b9d3","callback":"0x0000000000000000000000000000000000000000","params":"<parameters>","salt":"0xd24c18531fb8fabdbaf082787e807c38","sign":{"r":"0x73cf2dda4c024dc82accaa1c5bd6251ae8cea8bce88ae9b2ed54328786b96538","s":"0x7f81c98a579c679408c2831e7df26b86074ea5f009d443874c9b990602a54183","v":28}}
	)));



});
