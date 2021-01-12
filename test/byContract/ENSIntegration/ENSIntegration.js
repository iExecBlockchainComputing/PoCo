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
var ERLCSwap           = artifacts.require('@iexec/erlc/ERLCSwap');
var ERC1538Proxy       = artifacts.require("iexec-solidity/ERC1538Proxy");
var IexecInterface     = artifacts.require(`IexecInterface${DEPLOYMENT.asset}`);
var AppRegistry        = artifacts.require("AppRegistry");
var DatasetRegistry    = artifacts.require("DatasetRegistry");
var WorkerpoolRegistry = artifacts.require("WorkerpoolRegistry");
var App                = artifacts.require("App");
var Dataset            = artifacts.require("Dataset");
var Workerpool         = artifacts.require("Workerpool");
var ENSRegistry        = artifacts.require("@ensdomains/ens/ENSRegistry");

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const tools     = require("../../../utils/tools");
const enstools  = require("../../../utils/ens-tools");
const odbtools  = require("../../../utils/odb-tools");
const constants = require("../../../utils/constants");

Object.extract = (obj, keys) => keys.map(key => obj[key]);

contract('ENSIntegration', async (accounts) => {

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
	var ENSInstance                = null;

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
		ENSInstance                = await ENSRegistry.deployed();
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

	/***************************************************************************
	 *                                                                         *
	 ***************************************************************************/
	describe("Initial state (migration)", async () => {
		it("lookup", async () => {
			assert.equal(await enstools.lookup(IexecInstance.address             ), "core.v5.iexec.eth"       );
			assert.equal(await enstools.lookup(AppRegistryInstance.address       ), "apps.v5.iexec.eth"       );
			assert.equal(await enstools.lookup(DatasetRegistryInstance.address   ), "datasets.v5.iexec.eth"   );
			assert.equal(await enstools.lookup(WorkerpoolRegistryInstance.address), "workerpools.v5.iexec.eth");
		})
		it("resolve", async () => {
			if (DEPLOYMENT.asset == "Token") {
				assert.equal(await enstools.resolve("rlc.iexec.eth"), (await RLC.deployed()).address);
			}
			if (DEPLOYMENT.asset == "Token" && !!process.env.KYC) {
				assert.equal(await enstools.resolve("erlc.iexec.eth"), (await ERLCSwap.deployed()).address);
			}
			assert.equal(await enstools.resolve("core.v5.iexec.eth"       ), IexecInstance.address             );
			assert.equal(await enstools.resolve("apps.v5.iexec.eth"       ), AppRegistryInstance.address       );
			assert.equal(await enstools.resolve("datasets.v5.iexec.eth"   ), DatasetRegistryInstance.address   );
			assert.equal(await enstools.resolve("workerpools.v5.iexec.eth"), WorkerpoolRegistryInstance.address);
		});
	});

	describe("Reverse register", async () => {
		describe("unauthorized", async () => {
			it("reverts", async () => {
				await expectRevert(IexecInstance.setName(ENSInstance.address, "wrong.domain.eth", { from: user.address }), "Ownable: caller is not the owner");
			});
		});

		describe("authorized", async () => {
			it("success", async () => {
				await IexecInstance.setName(ENSInstance.address, "test.namespace.eth", { from: iexecAdmin.address });
			});

			it("lookup", async () => {
				assert.equal(await enstools.lookup(IexecInstance.address), "test.namespace.eth");
			});
		});
	});
});
