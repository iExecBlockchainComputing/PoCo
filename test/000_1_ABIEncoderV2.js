const TestABIEncoderV2 = artifacts.require("./TestABIEncoderV2.sol");
const OwnableOZ        = artifacts.require("./OwnableOZ.sol");
const ethers = require('ethers');

function getDappMarketHash(marketplace, dappmarket)
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
function getDataMarketHash(marketplace, datamarket)
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
function getPoolMarketHash(marketplace, poolmarket)
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
function getUserMarketHash(marketplace, usermarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'address',
		'uint256',
		'address',
		'uint256',
		'address',
		'uint256',
		'address',
		'uint256',
		'uint256',
		'address',
		'address',
		'string',
		'bytes32',
	],[
		marketplace,
		usermarket.dapp,
		usermarket.dappprice,
		usermarket.data,
		usermarket.dataprice,
		usermarket.pool,
		usermarket.poolprice,
		usermarket.requester,
		usermarket.category,
		usermarket.trust,
		usermarket.beneficiary,
		usermarket.callback,
		usermarket.params,
		usermarket.salt,
	]);
}
function sign(wallet, hash)
{
	// return ethers.utils.splitSignature(wallet.signMessage(hash));
	return ethers.utils.splitSignature(web3.eth.sign(wallet, hash));
}





let abi        = JSON.stringify(TestABIEncoderV2.abi);
// web3.currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
// provider             = new ethers.providers.Web3Provider(web3.currentProvider);
let provider   = new ethers.providers.JsonRpcProvider('http://localhost:8545');
var contract   = null;

let user       = web3.eth.accounts[0];
let dappOwner  = web3.eth.accounts[1];
let dataOwner  = web3.eth.accounts[2];
let poolOwner  = web3.eth.accounts[3];

var dappmarket = null;
var datamarket = null;
var poolmarket = null;
var usermarket = null;





it("Initialisation", async function(){

	instance = await TestABIEncoderV2.new();
	contract = new ethers.Contract(instance.address, abi, provider);
	console.log("TestABIEncoderV2 at:", instance.address);

	dappInstance = await OwnableOZ.new();
	dataInstance = await OwnableOZ.new();
	poolInstance = await OwnableOZ.new();
	_            = await dappInstance.transferOwnership(dappOwner);
	_            = await dataInstance.transferOwnership(dataOwner);
	_            = await poolInstance.transferOwnership(poolOwner);
	console.log("dapp, data and pool created");
});

it("build markets", async function(){
	dappmarket = {
		//market
		dapp:        dappInstance.address,
		dappprice:   3,
		volume:      1000,
		// extra
		salt:        ethers.utils.randomBytes(32),
		sign:        null
	};
	datamarket = {
		//market
		// data:        '0x0000000000000000000000000000000000000000',
		data:        dataInstance.address,
		dataprice:   1,
		volume:      1000,
		// extra
		salt:        ethers.utils.randomBytes(32),
		sign:        null
	};
	poolmarket = {
		// market
		pool:        poolInstance.address,
		poolprice:   25,
		volume:      3,
		// settings
		category:    4,
		trust:       1000,
		// extra
		salt:        ethers.utils.randomBytes(32),
		sign:        null
	};
	usermarket = {
		// market
		dapp:        dappInstance.address,
		dappprice:   3,
		data:        dataInstance.address,
		dataprice:   1,
		pool:        poolInstance.address,
		poolprice:   25,
		requester:   user,
		// settings
		category:    4,
		trust:       1000,
		beneficiary: user,
		callback:    '0x0000000000000000000000000000000000000000',
		params:      "echo HelloWorld",
		// extra
		salt:        ethers.utils.randomBytes(32),
		sign:        null, // defined later
	};
});

it("sign markets", async function(){
	dappmarket.sig = sign(dappOwner, getDappMarketHash(contract.address, dappmarket));
	datamarket.sig = sign(dataOwner, getDataMarketHash(contract.address, datamarket));
	poolmarket.sig = sign(poolOwner, getPoolMarketHash(contract.address, poolmarket));
	usermarket.sig = sign(user,      getUserMarketHash(contract.address, usermarket));
});

it("verify hashs", async function(){
	contract.getDappMarketHash(dappmarket).then(function(result) {
		console.log("dappmarket hash:", result);
		assert.strictEqual(result, getDappMarketHash(contract.address, dappmarket), "Error with dappmarket hash computation");
	});
	contract.getDataMarketHash(datamarket).then(function(result) {
		console.log("datamarket hash:", result);
		assert.strictEqual(result, getDataMarketHash(contract.address, datamarket), "Error with datamarket hash computation");
	});
	contract.getPoolMarketHash(poolmarket).then(function(result) {
		console.log("poolmarket hash:", result);
		assert.strictEqual(result, getPoolMarketHash(contract.address, poolmarket), "Error with poolmarket hash computation");
	});
	contract.getUserMarketHash(usermarket).then(function(result) {
		console.log("usermarket hash:", result);
		assert.strictEqual(result, getUserMarketHash(contract.address, usermarket), "Error with usermarket hash computation");
	});
});

it("verify signatures", async function(){
	contract.isValidSignature(
		dappOwner,
		getDappMarketHash(contract.address, dappmarket),
		dappmarket.sig
	).then(function(result) {
		assert(result, "Error with the validation of the dappmarket signature");
	});
	contract.isValidSignature(
		dataOwner,
		getDataMarketHash(contract.address, datamarket),
		datamarket.sig
	).then(function(result) {
		assert(result, "Error with the validation of the datamarket signature");
	});
	contract.isValidSignature(
		poolOwner,
		getPoolMarketHash(contract.address, poolmarket),
		poolmarket.sig
	).then(function(result) {
		assert(result, "Error with the validation of the poolmarket signature");
	});
	contract.isValidSignature(
		user,
		getUserMarketHash(contract.address, usermarket),
		usermarket.sig
	).then(function(result) {
		assert(result, "Error with the validation of the usermarket signature");
	});
});

it("make market", async function(){
	contract.matchOrders(
		dappmarket,
		datamarket,
		poolmarket,
		usermarket
	).then(function(result) {
		console.log("MatchOrder!");
		console.log(result);
	});
});
