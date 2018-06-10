const TestABI    = artifacts.require("./tests/TestABI.sol");
const Web3EthAbi = require('web3-eth-abi');

contract('IexecHub', async (accounts) => {

	var Instance = null;

	var entry1 = {
		a: 17,
		b: accounts[0],
		c: 0,
		d: "0x0000000000000000000000000000000000000000",
		e: "0x0000000000000000000000000000000000000000",
	};
	var key1 = "0x000000000000000000000000000000000000fa11"


	before("Setup", async() => {
		Instance = await TestABI.new();
	});

	it("viewData", async () => {
		output = await Instance.viewData.call(key1);
		console.log(output);

		// decode ?
	});

	it("pushData - encode", async () => {
		// try encode ?
		encoded = Web3EthAbi.encodeFunctionCall(
			Instance.abi.find((e) => { return e.name == 'pushData' }),
			[ key1, entry1 ]
		);
		console.log(encoded);
	});

	it("pushData", async () => {
		txMined = await Instance.pushData(key1, entry1, { from: accounts[0] });
		console.log(txMined);
	});

});
