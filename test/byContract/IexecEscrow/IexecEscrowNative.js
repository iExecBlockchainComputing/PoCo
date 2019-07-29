// Config
var DEPLOYMENT = require("../../../config/deployment.json")
// Artefacts
var RLC                = artifacts.require("rlc-faucet-contract/contracts/RLC");
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");

const { BN, expectEvent, expectRevert } = require('openzeppelin-test-helpers');
const multiaddr = require('multiaddr');
const constants = require("../../../utils/constants");
const odbtools  = require('../../../utils/odb-tools');
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

function extractEvents(txMined, address, name)
{
	return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
}

if (DEPLOYMENT.asset == "Native")
contract('EscrowNative', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = accounts[0];
	let sgxEnclave      = accounts[0];
	let appProvider     = accounts[1];
	let datasetProvider = accounts[2];
	let scheduler       = accounts[3];
	let worker1         = accounts[4];
	let worker2         = accounts[5];
	let worker3         = accounts[6];
	let worker4         = accounts[7];
	let worker5         = accounts[8];
	let user            = accounts[9];

	var RLCInstance                = null;
	var IexecInstance              = null;
	var AppRegistryInstance        = null;
	var DatasetRegistryInstance    = null;
	var WorkerpoolRegistryInstance = null;

	var categories = [];

	/***************************************************************************
	 *                        Environment configuration                        *
	 ***************************************************************************/
	before("configure", async () => {
		console.log("# web3 version:", web3.version);

		/**
		 * Retreive deployed contracts
		 */
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.deployed();
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
	});

	describe("fallback", async () => {
		it("success", async () => {
			assert.equal(await web3.eth.getBalance(IexecInstance.address), 0);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[0]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

			await web3.eth.sendTransaction({ from: accounts[0], to: IexecInstance.address, value: 100 });

			assert.equal(await web3.eth.getBalance(IexecInstance.address), 100);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[0]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
		});
	});

	describe("deposit", async () => {
		it("success", async () => {
			assert.equal(await web3.eth.getBalance(IexecInstance.address), 100);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

			txMined = await IexecInstance.deposit({ from: accounts[1], value: 100, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			assert.equal(await web3.eth.getBalance(IexecInstance.address), 200);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
		});

		it("emit events", async () => {
			events = extractEvents(txMined, IexecInstance.address, "Transfer");
			assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
			assert.equal(events[0].args.to,    accounts[1]);
			assert.equal(events[0].args.value, 100);
		});
	});

	describe("depositFor", async () => {
		it("success", async () => {
			assert.equal(await web3.eth.getBalance(IexecInstance.address), 200);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

			txMined = await IexecInstance.depositFor(accounts[3], { from: accounts[2], value: 100, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [   0, 0 ], "check balance");
			assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
		});

		it("emit events", async () => {
			events = extractEvents(txMined, IexecInstance.address, "Transfer");
			assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
			assert.equal(events[0].args.to,    accounts[3]);
			assert.equal(events[0].args.value, 100);
		});
	});

	describe("depositForArray", async () => {
		describe("length missmatch", () => {
			describe("amounts.length > target.length", () => {
				it("reverts", async () => {
					assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

					await expectRevert.unspecified(IexecInstance.depositForArray(
						[ 100, 100, ],
						[ accounts[5] ],
						{ from: accounts[4], value: 200, gas: constants.AMOUNT_GAS_PROVIDED }
					));

					assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				});
			});

			describe("amounts.length > target.length", () => {
				it("reverts", async () => {
					assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

					await expectRevert.unspecified(IexecInstance.depositForArray(
						[ 100 ],
						[ accounts[5], accounts[6] ],
						{ from: accounts[4], value: 200, gas: constants.AMOUNT_GAS_PROVIDED }
					));

					assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				});
			});
		});

		describe("length match", () => {
			it("success", async () => {
				assert.equal(await web3.eth.getBalance(IexecInstance.address), 300);
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				txMined = await IexecInstance.depositForArray(
					[ 100, 100 ],
					[ accounts[5], accounts[6] ],
					{ from: accounts[4], value: 200, gas: constants.AMOUNT_GAS_PROVIDED }
				);

				assert.equal(await web3.eth.getBalance(IexecInstance.address), 500);
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[4]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [   0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[0].args.to,    accounts[5]);
				assert.equal(events[0].args.value, 100);
				assert.equal(events[1].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[1].args.to,    accounts[6]);
				assert.equal(events[1].args.value, 100);
			});
		});

		describe("excess value", () => {
			it("success", async () => {
				assert.equal(await web3.eth.getBalance(IexecInstance.address), 500);
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[8]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[9]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				txMined = await IexecInstance.depositForArray(
					[ 100, 100 ],
					[ accounts[8], accounts[9] ],
					{ from: accounts[7], value: 250, gas: constants.AMOUNT_GAS_PROVIDED }
				);

				assert.equal(await web3.eth.getBalance(IexecInstance.address), 750);
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [  50, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[8]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[9]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[0].args.to,    accounts[8]);
				assert.equal(events[0].args.value, 100);
				assert.equal(events[1].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[1].args.to,    accounts[9]);
				assert.equal(events[1].args.value, 100);
				assert.equal(events[2].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[2].args.to,    accounts[7]);
				assert.equal(events[2].args.value, 50);
			});
		});
	});

	describe("withdraw", async () => {
		describe("empty balance", async () => {
			it("reverts", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(100, { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("insufficient balance", async () => {
			it("reverts", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[0]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(1000, { from: accounts[0], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[0]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});
		});

		describe("sufficient balance", async () => {
			it("success", async () => {
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				txMined = await IexecInstance.withdraw(100, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  accounts[1]);
				assert.equal(events[0].args.to,    constants.NULL.ADDRESS);
				assert.equal(events[0].args.value, 100);
			});
		});

	});

	describe("recover", async () => {
		describe("unauthorized access", async () => {
			it("reverts", async () => {
				await expectRevert(IexecInstance.recover({ from: user, gas: constants.AMOUNT_GAS_PROVIDED }), "Ownable: caller is not the owner.");
			});
		});

		describe("no locked funds", async () => {
			it("success", async () => {
				txMined = await IexecInstance.recover({ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("emit events", async () => {
				events = extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter" );
				assert.equal(events[0].args.to,    iexecAdmin,             "check owner");
				assert.equal(events[0].args.value, 0,                      "check amount");
			});
		});
	});
});
