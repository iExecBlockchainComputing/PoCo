const Marketplace_ABIEncoderV2 = artifacts.require("./Marketplace_ABIEncoderV2.sol");
const OwnableOZ        = artifacts.require("./OwnableOZ.sol");
const ethers = require('ethers');

function getDappOrderHash(marketplace, dappmarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'address',
		'uint256',
		'uint256',
		'bytes32',
	],[
		marketplace,
		dappmarket.dapp,
		dappmarket.dappprice,
		dappmarket.volume,
		dappmarket.salt,
	]);
}
function getDataOrderHash(marketplace, datamarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'address',
		'uint256',
		'uint256',
		'bytes32',
	],[
		marketplace,
		datamarket.data,
		datamarket.dataprice,
		datamarket.volume,
		datamarket.salt,
	]);
}
function getPoolOrderHash(marketplace, poolmarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'address',
		'uint256',
		'uint256',
		'uint256',
		'uint256',
		'bytes32',
	],[
		marketplace,
		poolmarket.pool,
		poolmarket.poolprice,
		poolmarket.volume,
		poolmarket.category,
		poolmarket.trust,
		poolmarket.salt,
	]);
}
function getUserOrderHash(marketplace, usermarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'address',
		'uint256',
		'address',
		'uint256',
		'address',
		'uint256',
		'uint256',
		'uint256',
		'address',
		'address',
		'address',
		'string',
		'bytes32',
	],[
		marketplace,
		usermarket.dapp,
		usermarket.dapppricemax,
		usermarket.data,
		usermarket.datapricemax,
		usermarket.pool,
		usermarket.poolpricemax,
		usermarket.category,
		usermarket.trust,
		usermarket.requester,
		usermarket.beneficiary,
		usermarket.callback,
		usermarket.params,
		usermarket.salt,
	]);
}
function signMarket(object, wallet, hashing)
{
	object.sign = ethers.utils.splitSignature(web3.eth.sign(wallet, hashing(object)));
	return object
}






let abi        = JSON.stringify(Marketplace_ABIEncoderV2.abi);
// web3.currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
// provider             = new ethers.providers.Web3Provider(web3.currentProvider);
let provider  = new ethers.providers.JsonRpcProvider('http://localhost:8545');
var contract  = null;

let user      = web3.eth.accounts[0];
let dappOwner = web3.eth.accounts[1];
let dataOwner = web3.eth.accounts[2];
let poolOwner = web3.eth.accounts[3];

var dapporder = null;
var dataorder = null;
var poolorder = null;
var userorder = null;




it("Initialisation", async function(){

	instance = await Marketplace_ABIEncoderV2.new();
	contract = new ethers.Contract(instance.address, abi, provider);
	console.log("Marketplace_ABIEncoderV2 at:", instance.address);

	dappInstance = await OwnableOZ.new();
	dataInstance = await OwnableOZ.new();
	poolInstance = await OwnableOZ.new();
	_            = await dappInstance.transferOwnership(dappOwner);
	_            = await dataInstance.transferOwnership(dataOwner);
	_            = await poolInstance.transferOwnership(poolOwner);
	console.log("dapp, data and pool created");
});

it("build orders", async function(){
	dapporder = {
		//market
		dapp:         dappInstance.address,
		dappprice:    3,
		volume:       1000,
		// extra
		salt:         ethers.utils.randomBytes(32),
		sign:         null
	};
	dataorder = {
		//market
		data:         dataInstance.address,
		dataprice:    1,
		volume:       1000,
		// extra
		salt:         ethers.utils.randomBytes(32),
		sign:         null
	};
	poolorder = {
		// market
		pool:         poolInstance.address,
		poolprice:    25,
		volume:       3,
		// settings
		category:     4,
		trust:        1000,
		// extra
		salt:         ethers.utils.randomBytes(32),
		sign:         null
	};
	userorder = {
		// market
		dapp:         dappInstance.address,
		dapppricemax: 3,
		data:         dataInstance.address,
		datapricemax: 1,
		pool:         poolInstance.address,
		poolpricemax: 25,
		// settings
		category:     4,
		trust:        1000,
		requester:    user,
		beneficiary:  user,
		callback:     '0x0000000000000000000000000000000000000000',
		params:       "echo HelloWorld",
		// extra
		salt:         ethers.utils.randomBytes(32),
		sign:         null, // defined later
	};
});

it("sign orders", async function(){
	_ = signMarket(dapporder, dappOwner, (obj) => getDappOrderHash(contract.address, obj));
	_ = signMarket(dataorder, dataOwner, (obj) => getDataOrderHash(contract.address, obj));
	_ = signMarket(poolorder, poolOwner, (obj) => getPoolOrderHash(contract.address, obj));
	_ = signMarket(userorder, user,      (obj) => getUserOrderHash(contract.address, obj));
});

it("verify hashs", async function(){
	contract.getDappOrderHash(dapporder).then(function(result) {
		console.log("dappmarket hash:", result);
		assert.strictEqual(result, getDappOrderHash(contract.address, dapporder), "Error with dapporder hash computation");
	});
	contract.getDataOrderHash(dataorder).then(function(result) {
		console.log("datamarket hash:", result);
		assert.strictEqual(result, getDataOrderHash(contract.address, dataorder), "Error with dataorder hash computation");
	});
	contract.getPoolOrderHash(poolorder).then(function(result) {
		console.log("poolmarket hash:", result);
		assert.strictEqual(result, getPoolOrderHash(contract.address, poolorder), "Error with poolorder hash computation");
	});
	contract.getUserOrderHash(userorder).then(function(result) {
		console.log("usermarket hash:", result);
		assert.strictEqual(result, getUserOrderHash(contract.address, userorder), "Error with userorder hash computation");
	});
});

it("verify signatures", async function(){
	contract.isValidSignature(
		dappOwner,
		getDappOrderHash(contract.address, dapporder),
		dapporder.sign
	).then(function(result) {
		assert(result, "Error with the validation of the dapporder signature");
	});
	contract.isValidSignature(
		dataOwner,
		getDataOrderHash(contract.address, dataorder),
		dataorder.sign
	).then(function(result) {
		assert(result, "Error with the validation of the dataorder signature");
	});
	contract.isValidSignature(
		poolOwner,
		getPoolOrderHash(contract.address, poolorder),
		poolorder.sign
	).then(function(result) {
		assert(result, "Error with the validation of the poolorder signature");
	});
	contract.isValidSignature(
		user,
		getUserOrderHash(contract.address, userorder),
		userorder.sign
	).then(function(result) {
		assert(result, "Error with the validation of the userorder signature");
	});
});

it("make market", async function(){
	contract.matchOrders(
		dapporder,
		dataorder,
		poolorder,
		userorder
	).then(function(result) {
		console.log("MatchOrder!");
		console.log(result);
	});
});
