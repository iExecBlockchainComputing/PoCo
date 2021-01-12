/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

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
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

if (DEPLOYMENT.asset == "Token")
contract('EscrowToken', async (accounts) => {

	assert.isAtLeast(accounts.length, 10, "should have at least 10 accounts");
	let iexecAdmin      = null;
	let appProvider     = null;
	let datasetProvider = null;
	let scheduler       = null;
	let worker1         = null;
	let worker2         = null;
	let worker3         = null;
	let worker4         = null;
	let worker5         = null;
	let user            = null;

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
		IexecInstance              = await IexecInterface.at((await ERC1538Proxy.deployed()).address);
		AppRegistryInstance        = await AppRegistry.deployed();
		DatasetRegistryInstance    = await DatasetRegistry.deployed();
		WorkerpoolRegistryInstance = await WorkerpoolRegistry.deployed();
		ERC712_domain              = await IexecInstance.domain();
		RLCInstance                = DEPLOYMENT.asset == "Native" ? { address: constants.NULL.ADDRESS } : await RLC.at(await IexecInstance.token());

		broker          = new odbtools.Broker    (IexecInstance);
		iexecAdmin      = new odbtools.iExecAgent(IexecInstance, accounts[0]);
		appProvider     = new odbtools.iExecAgent(IexecInstance, accounts[1]);
		datasetProvider = new odbtools.iExecAgent(IexecInstance, accounts[2]);
		scheduler       = new odbtools.Scheduler (IexecInstance, accounts[3]);
		worker1         = new odbtools.Worker    (IexecInstance, accounts[4]);
		worker2         = new odbtools.Worker    (IexecInstance, accounts[5]);
		worker3         = new odbtools.Worker    (IexecInstance, accounts[6]);
		worker4         = new odbtools.Worker    (IexecInstance, accounts[7]);
		worker5         = new odbtools.Worker    (IexecInstance, accounts[8]);
		user            = new odbtools.iExecAgent(IexecInstance, accounts[9]);
		await broker.initialize();
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

				await expectRevert.unspecified(IexecInstance.deposit(100, { from: accounts[1] }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				await RLCInstance.transfer(accounts[1], 100, { from: accounts[0] });

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.deposit(100, { from: accounts[1] }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("approved", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[1]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await RLCInstance.approve(IexecInstance.address, 100, { from: accounts[1] });

				txMined = await IexecInstance.deposit(100, { from: accounts[1] });

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

				await expectRevert.unspecified(IexecInstance.depositFor(100, accounts[3], { from: accounts[2] }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				await RLCInstance.transfer(accounts[2], 100, { from: accounts[0] });

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositFor(100, accounts[3], { from: accounts[2] }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("approved", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[2]), 100, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await RLCInstance.approve(IexecInstance.address, 100, { from: accounts[2] });

				txMined = await IexecInstance.depositFor(100, accounts[3], { from: accounts[2] });

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
					{ from: accounts[4] }
				));

				assert.equal(await RLCInstance.balanceOf(accounts[4]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("not approved", async () => {
			it("reverts", async () => {
				await RLCInstance.transfer(accounts[4], 300, { from: accounts[0] });

				assert.equal(await RLCInstance.balanceOf(accounts[4]), 300, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[5]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[6]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[7]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.depositForArray(
					[ 100, 100, 100 ],
					[ accounts[5], accounts[6], accounts[7] ],
					{ from: accounts[4] }
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

						await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4] });

						await expectRevert.unspecified(IexecInstance.depositForArray(
							[ 100, 100, 100 ],
							[ accounts[5] ],
							{ from: accounts[4] }
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

						await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4] });

						await expectRevert.unspecified(IexecInstance.depositForArray(
							[ 100 ],
							[ accounts[5], accounts[6], accounts[7] ],
							{ from: accounts[4] }
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

					await RLCInstance.approve(IexecInstance.address, 300, { from: accounts[4] });

					txMined = await IexecInstance.depositForArray(
						[ 100, 100, 100 ],
						[ accounts[5], accounts[6], accounts[7] ],
						{ from: accounts[4] }
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
			const balanceBefore = await RLCInstance.balanceOf(accounts[0]);
			const accountBefore = await IexecInstance.balanceOf(accounts[0]);
			const amount        = web3.utils.toBN(1000);

			await RLCInstance.approveAndCall(IexecInstance.address, amount, "0x", { from: accounts[0] });

			assert.equal(await RLCInstance.balanceOf(accounts[0]),   balanceBefore.sub(amount).toString());
			assert.equal(await IexecInstance.balanceOf(accounts[0]), accountBefore.add(amount).toString());
		});

		describe("wrong token protection", async () => {
			it("create dummy token", async () => {
				DummyToken = await RLC.new({ from: accounts[9] });
			});

			it("reverts", async () => {
				const balanceBefore = await RLCInstance.balanceOf(accounts[0]);
				const accountBefore = await IexecInstance.balanceOf(accounts[0]);
				const amount        = web3.utils.toBN(1000);

				await expectRevert(DummyToken.approveAndCall(IexecInstance.address, amount, "0x", { from: accounts[9] }), "wrong-token");

				assert.equal(await RLCInstance.balanceOf(accounts[0]),   balanceBefore.toString());
				assert.equal(await IexecInstance.balanceOf(accounts[0]), accountBefore.toString());
			});
		});
	});

	describe("withdraw", async () => {
		describe("empty balance", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(100, { from: accounts[2] }));

				assert.equal(await RLCInstance.balanceOf(accounts[2]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[2]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 0, 0 ], "check balance");
			});
		});

		describe("insufficient balance", async () => {
			it("reverts", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				await expectRevert.unspecified(IexecInstance.withdraw(1000, { from: accounts[1] }));

				assert.equal(await RLCInstance.balanceOf(accounts[1]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[1]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");
			});
		});

		describe("sufficient balance", async () => {
			it("success", async () => {
				assert.equal(await RLCInstance.balanceOf(accounts[3]), 0, "wrong rlc balance");
				assert.deepEqual(Object.extract(await IexecInstance.viewAccount(accounts[3]), [ 'stake', 'locked' ]).map(bn => Number(bn)), [ 100, 0 ], "check balance");

				txMined = await IexecInstance.withdraw(100, { from: accounts[3] });

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
				await expectRevert(IexecInstance.recover({ from: accounts[9] }), "Ownable: caller is not the owner.");
			});
		});

		describe("no locked funds", async () => {
			it("success", async () => {
				txMined = await IexecInstance.recover({ from: accounts[0] });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter");
				assert.equal(events[0].args.to,    accounts[0],            "check owner");
				assert.equal(events[0].args.value, 0,                      "check amount");
			});
		});

		describe("locked funds", async () => {
			it("locking funds", async () => {
				await RLCInstance.transfer(IexecInstance.address, 1000, { from: accounts[0] });
			});

			it("success", async () => {
				txMined = await IexecInstance.recover({ from: accounts[0] });
			});

			it("emit events", async () => {
				events = tools.extractEvents(txMined, IexecInstance.address, "Transfer");
				assert.equal(events[0].args.from,  constants.NULL.ADDRESS, "check minter");
				assert.equal(events[0].args.to,    accounts[0],            "check owner");
				assert.equal(events[0].args.value, 1000,                   "check amount");
			});
		});
	});
});
