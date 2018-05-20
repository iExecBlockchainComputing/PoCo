var TestABIEncoderV2 = artifacts.require("./TestABIEncoderV2.sol");

const ethers    = require('ethers');
const web3utils = require('web3-utils');

function getUserMarketHash(marketplace, usermarket)
{
	return web3utils.soliditySha3(
		marketplace,
		usermarket.category,
		usermarket.trust,
		usermarket.value,
		usermarket.app,
		usermarket.dataset,
		usermarket.callback,
		usermarket.beneficiary,
		usermarket.requester,
		usermarket.params,
		usermarket.salt,
	);
}
function getPoolMarketHash(marketplace, usermarket)
{
	return web3utils.soliditySha3(
		marketplace,
		usermarket.category,
		usermarket.trust,
		usermarket.value,
		usermarket.volume,
		usermarket.workerpool,
		usermarket.salt,
	);
}
function signObject(wallet, object, hash)
{
	var sig = ethers.utils.splitSignature(wallet.signMessage(hash));
	object.r = sig.r;
	object.s = sig.s;
	object.v = sig.v;
}





it("TestABIEncoderV2", async function() {

	instance = await TestABIEncoderV2.new();
	console.log("instance.address is", instance.address);

	let abi      = JSON.stringify(TestABIEncoderV2.abi);
	let provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
	let contract = new ethers.Contract(instance.address, abi, provider);
	let wallet   = ethers.Wallet.createRandom();

	var usermarket = {
		category:    4,
		trust:       1000,
		value:       25,
		app:         '0x0000000000000000000000000000000000000000',
		dataset:     '0x0000000000000000000000000000000000000000',
		callback:    '0x0000000000000000000000000000000000000000',
		beneficiary: '0x0000000000000000000000000000000000000000',
		requester:   wallet.address,
		params:      "echo HelloWorld",
		salt:        web3utils.randomHex(32)
	};
	// signObject(wallet, usermarket, getUserMarketHash(contract.address, usermarket));
	signObject(wallet, usermarket, "");

	var poolmarket = {
		category:    4,
		trust:       1000,
		value:       25,
		volume:      3,
		workerpool:  wallet.address, //'0x0000000000000000000000000000000000000000',
		salt:        web3utils.randomHex(32)
	};
	// signObject(wallet, poolmarket, getPoolMarketHash(contract.address, poolmarket));
	signObject(wallet, poolmarket, "");


	contract.matchOrders(usermarket, poolmarket).then(function(result) {
		console.log(result);
	});

});
