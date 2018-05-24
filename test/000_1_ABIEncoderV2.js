var TestABIEncoderV2 = artifacts.require("./TestABIEncoderV2.sol");

const ethers    = require('ethers');
// const web3utils = require('web3-utils');


function getPoolMarketHash(marketplace, usermarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'uint256',
		'uint256',
		'uint256',
		'uint256',
		'address',
		'bytes32',
	],[
		marketplace,
		usermarket.category,
		usermarket.trust,
		usermarket.value,
		usermarket.volume,
		usermarket.workerpool,
		usermarket.salt,
	]);
}
function getUserMarketHash(marketplace, usermarket)
{
	return ethers.utils.solidityKeccak256([
		'address',
		'uint256',
		'uint256',
		'uint256',
		'address',
		'address',
		'address',
		'address',
		'address',
		'string',
		'bytes32',
	],[
		marketplace,
		usermarket.category,
		usermarket.trust,
		usermarket.value,
		usermarket.app,
		usermarket.dataset,
		usermarket.requester,
		usermarket.beneficiary,
		usermarket.callback,
		usermarket.params,
		usermarket.salt,
	]);
}
function signObject(wallet, object, hash)
{
	// var sig = ethers.utils.splitSignature(wallet.signMessage(hash));
	var sig = ethers.utils.splitSignature(web3.eth.sign(wallet, hash));
	object.r = sig.r;
	object.s = sig.s;
	object.v = sig.v;
}






let wallet   = web3.eth.accounts[0];
var contract = null;



var poolmarket = {
	category:    4,
	trust:       1000,
	value:       25,
	volume:      3,
	workerpool:  wallet, //'0x0000000000000000000000000000000000000000',
	salt:        ethers.utils.randomBytes(32)
	// salt:        web3utils.randomHex(32)
};

var usermarket = {
	category:    4,
	trust:       1000,
	value:       25,
	app:         '0x0000000000000000000000000000000000000000',
	dataset:     '0x0000000000000000000000000000000000000000',
	requester:   wallet,
	beneficiary: wallet,
	callback:    '0x0000000000000000000000000000000000000000',
	params:      "echo HelloWorld",
	salt:        ethers.utils.randomBytes(32)
	// salt:        web3utils.randomHex(32)
};




it("ContractCreate", async function() {
	instance = await TestABIEncoderV2.new();
	console.log("instance.address is", instance.address);
	abi                  = JSON.stringify(TestABIEncoderV2.abi);
	web3.currentProvider = new web3.providers.HttpProvider('http://localhost:8545');
	provider             = new ethers.providers.Web3Provider(web3.currentProvider);
	// provider             = new ethers.providers.JsonRpcProvider('http://localhost:8545');
	contract             = new ethers.Contract(instance.address, abi, provider);
});




it("sign markets", async function() {
	signObject(wallet, poolmarket, getPoolMarketHash(contract.address, poolmarket));
	signObject(wallet, usermarket, getUserMarketHash(contract.address, usermarket));
});

it("verify hashs", async function() {
	contract.getPoolMarketHash(poolmarket).then(function(result) {
		console.log("poolmarket hash:", result);
		assert.strictEqual(result, getPoolMarketHash(contract.address, poolmarket), "Error with poolmarket hash computation");
	});
	contract.getUserMarketHash(usermarket).then(function(result) {
		console.log("usermarket hash:", result);
		assert.strictEqual(result, getUserMarketHash(contract.address, usermarket), "Error with usermarket hash computation");
	});
});

it("verify signatures", async function() {
	contract.isValidSignature(
		wallet,
		getPoolMarketHash(contract.address, poolmarket),
		poolmarket.v,
		poolmarket.r,
		poolmarket.s
	).then(function(result) {
		assert(result, "Error with the validation of the poolmarket signature");
	});
	contract.isValidSignature(
		wallet,
		getUserMarketHash(contract.address, usermarket),
		usermarket.v,
		usermarket.r,
		usermarket.s
	).then(function(result) {
		assert(result, "Error with the validation of the usermarket signature");
	});
});

it("make market", async function() {
	contract.matchOrders(poolmarket, usermarket).then(function(result) {
		console.log("MatchOrder!");
		console.log(result);
	});
	contract.matchOrders(poolmarket, usermarket).then(function(result) {
		console.log("MatchOrder!");
		console.log(result);
	});
});
