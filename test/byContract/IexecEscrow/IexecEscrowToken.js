// Config
var DEPLOYMENT         = require("../../../config/config.json").chains.default;
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

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const multiaddr = require('multiaddr');
const tools     = require("../../../utils/tools");
const enstools  = require('../../../utils/ens-tools');
const odbtools  = require('../../../utils/odb-tools');
const constants = require("../../../utils/constants");
const wallets   = require('../../../utils/wallets');

Object.extract = (obj, keys) => keys.map(key => obj[key]);

if (DEPLOYMENT.asset == "Token")
contract('EscrowToken', async (accounts) => {

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

		ERC712_domain              = await IexecInstance.domain();
	});

	describe("fallback", async () => {
		it("success", async () => {
			await expectRevert(web3.eth.sendTransaction({ from: accounts[0], to: IexecInstance.address, value: 100 }), "fallback-disabled");
		});
	});

	describe("deposit", async () => {
		describe("no tokens", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.deposit(100, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				txMined = await RLCInstance.transfer(accounts[1], 100, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.deposit(100, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("approved", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				txMined = await RLCInstance.approve(IexecInstance.address, 100, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				txMined = await IexecInstance.deposit(100, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, RLCInstance.address, "Transfer");
				assert.equal(events[0].args.from,  accounts[1]);
				assert.equal(events[0].args.to,    IexecInstance.address);
				assert.equal(events[0].args.value, 100);

				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[0].args.to,    accounts[1]);
				assert.equal(events[0].args.value, 100);
			});
		});
	});

	describe("depositFor", async () => {
		describe("no tokens", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositFor(100, accounts[3], { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				txMined = await RLCInstance.transfer(accounts[2], 100, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositFor(100, accounts[3], { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("approved", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				txMined = await RLCInstance.approve(IexecInstance.address, 100, { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				txMined = await IexecInstance.depositFor(100, accounts[3], { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, RLCInstance.address, "Transfer");
				assert.equal(events[0].args.from,  accounts[2]);
				assert.equal(events[0].args.to,    IexecInstance.address);
				assert.equal(events[0].args.value, 100);

				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
				assert.equal(events[0].args.to,    accounts[3]);
				assert.equal(events[0].args.value, 100);
			});
		});
	});

	describe("depositForArray", async () => {
		describe("no tokens", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[4]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositForArray(
					[ 100, 100, 100 ],
					[ accounts[5], accounts[6], accounts[7] ],
					{ from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED }
				));

				assert.equal(await RLCInstance.balanceOf(accounts[4]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				txMined = await RLCInstance.transfer(accounts[4], 300, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositForArray(
					[ 100, 100, 100 ],
					[ accounts[5], accounts[6], accounts[7] ],
					{ from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED }
				));

				assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("approved", async () => {
			describe("length missmatch", () => {
				describe("amounts.length > target.length", () => {
					it("reverts", async () => {
						assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

						txMined = await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED });

						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						await expectRevert.unspecified(IexecInstance.depositForArray(
							[ 100, 100, 100 ],
							[ accounts[5] ],
							{ from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED }
						));

						assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					});
				});

				describe("amounts.length > target.length", () => {
					it("reverts", async () => {
						assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

						txMined = await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED });

						assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
						await expectRevert.unspecified(IexecInstance.depositForArray(
							[ 100 ],
							[ accounts[5], accounts[6], accounts[7] ],
							{ from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED }
						));

						assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
						assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					});
				});
			});

			describe("length match", () => {
				it("success", async () => {
					assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

					txMined = await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED });
					assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

					txMined = await IexecInstance.depositForArray(
						[ 100, 100, 100 ],
						[ accounts[5], accounts[6], accounts[7] ],
						{ from: accounts[4], gas: constants.AMOUNT_GAS_PROVIDED }
					);

					assert.equal(await RLCInstance.balanceOf(accounts[4]), 0, "wrong rlc balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
					assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
				});

				it("emit events", async () => {
					events = tools.extractEvents(txMined, RLCInstance.address, "Transfer");
					assert.equal(events[0].args.from,  accounts[4]);
					assert.equal(events[0].args.to,    IexecInstance.address);
					assert.equal(events[0].args.value, 100);
					assert.equal(events[1].args.from,  accounts[4]);
					assert.equal(events[1].args.to,    IexecInstance.address);
					assert.equal(events[1].args.value, 100);
					assert.equal(events[2].args.from,  accounts[4]);
					assert.equal(events[2].args.to,    IexecInstance.address);
					assert.equal(events[2].args.value, 100);

					events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
					assert.equal(events[0].args.from,  constants.NULL.ADDRESS);
					assert.equal(events[0].args.to,    accounts[5]);
					assert.equal(events[0].args.value, 100);
					assert.equal(events[1].args.from,  constants.NULL.ADDRESS);
					assert.equal(events[1].args.to,    accounts[6]);
					assert.equal(events[1].args.value, 100);
					assert.equal(events[2].args.from,  constants.NULL.ADDRESS);
					assert.equal(events[2].args.to,    accounts[7]);
					assert.equal(events[2].args.value, 100);
				});
			});
		});
	});

	describe("ApproveAndCall", async () => {
		it("success", async () => {
			const balanceBefore = await RLCInstance.balanceOf(iexecAdmin);
			const accountBefore = await IexecInstance.balanceOf(iexecAdmin);
			const amount        = web3.utils.toBN(1000);

			txMined = await RLCInstance.approveAndCall(IexecInstance.address, amount, "0x", { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
			assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

			assert.equal(await RLCInstance.balanceOf(iexecAdmin),   balanceBefore.sub(amount).toString());
			assert.equal(await IexecInstance.balanceOf(iexecAdmin), accountBefore.add(amount).toString());
		});

		describe("wrong token protection", async () => {
			it("create dummy token", async () => {
				DummyToken = await RLC.new({ from: user, gas: constants.AMOUNT_GAS_PROVIDED });
			});

			it("reverts", async () => {
				const balanceBefore = await RLCInstance.balanceOf(iexecAdmin);
				const accountBefore = await IexecInstance.balanceOf(iexecAdmin);
				const amount        = web3.utils.toBN(1000);

				await expectRevert(DummyToken.approveAndCall(IexecInstance.address, amount, "0x", { from: user, gas: constants.AMOUNT_GAS_PROVIDED }), "wrong-token");

				assert.equal(await RLCInstance.balanceOf(iexecAdmin),   balanceBefore.toString());
				assert.equal(await IexecInstance.balanceOf(iexecAdmin), accountBefore.toString());
			});
		});
	});

	describe("withdraw", async () => {
		describe("empty balance", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(100, { from: accounts[2], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("insufficient balance", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(1000, { from: accounts[1], gas: constants.AMOUNT_GAS_PROVIDED }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});
		});

		describe("sufficient balance", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[3]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				txMined = await IexecInstance.withdraw(100, { from: accounts[3], gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");

				assert.equal(await RLCInstance.balanceOf(accounts[3]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, RLCInstance.address, "Transfer");
				assert.equal(events[0].args.from,  IexecInstance.address);
				assert.equal(events[0].args.to,    accounts[3]);
				assert.equal(events[0].args.value, 100);

				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  accounts[3]);
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
				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter" );
				assert.equal(events[0].args.to,    iexecAdmin,             "check owner");
				assert.equal(events[0].args.value, 0,                      "check amount");
			});
		});

		describe("locked funds", async () => {
			it("locking funds", async () => {
				txMined = await RLCInstance.transfer(IexecInstance.address, 1000, { from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("success", async () => {
				txMined = await IexecInstance.recover({ from: iexecAdmin, gas: constants.AMOUNT_GAS_PROVIDED });
				assert.isBelow(txMined.receipt.gasUsed, constants.AMOUNT_GAS_PROVIDED, "should not use all gas");
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter" );
				assert.equal(events[0].args.to,    iexecAdmin,             "check owner");
				assert.equal(events[0].args.value, 1000,                   "check amount");
			});
		});
	});
});
