/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
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

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
    IexecLibOrders_v5,
    IexecPocoBoostDelegate__factory, IexecPocoBoostDelegate,
    ERC1538Update__factory, ERC1538Update,
    ERC1538Query__factory, ERC1538Query,
    ERC1538Proxy,
    AppRegistry__factory,
} from "../typechain";
import deployPocoNominal from "./truffle-fixture";
import { getFunctionSignatures } from "../migrations/utils/getFunctionSignatures";
const erc1538Proxy: ERC1538Proxy = hre.artifacts.require('@iexec/solidity/ERC1538Proxy')
import constants from "../utils/constants";
import { extractEventsFromReceipt } from "../utils/tools";
import { createRequestOrder, createAppOrder } from "../utils/createOrders";

describe("IexecPocoBoostDelegate", function () {
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;
    let requestOrder: IexecLibOrders_v5.RequestOrderStruct;
    let appOrder: IexecLibOrders_v5.AppOrderStruct;
    let appAddress = "";
    beforeEach("Deploy IexecPocoBoostDelegate", async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        const boostDeployment = (await loadFixture(deployPocoBoostFixture))
        iexecPocoBoostInstance = boostDeployment.iexecPocoBoostInstance
        appAddress = boostDeployment.appAddress
        requestOrder = createRequestOrder()
        appOrder = createAppOrder()
    });

    describe("MatchOrders", function () {
        it("Should match orders", async function () {
            requestOrder.app = appAddress;
            appOrder.app = appAddress;
            const expectedDealId =
                "0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5";
            await expect(iexecPocoBoostInstance.matchOrdersBoost(requestOrder, appOrder))
                .to.emit(iexecPocoBoostInstance, "OrdersMatchedBoost")
                .withArgs(expectedDealId);
            expect((await iexecPocoBoostInstance.viewDealBoost(expectedDealId)).tag)
                .is.equal("0x0000000000000000000000000000000000000000000000000000000000000000")
        });

        it("Should not match orders", async function () {
            requestOrder.tag = "0x0000000000000000000000000000000000000000000000000000000000000001"
            await expect(iexecPocoBoostInstance.matchOrdersBoost(requestOrder, appOrder))
                .to.be.revertedWith("Incompatible request and app orders");
        });
    });

    describe("PushResult", function () {
        it("Should push result", async function () {
            requestOrder.app = appAddress;
            appOrder.app = appAddress;
            const dealId: string =
                "0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5";
            const index: number = 0;
            // 0xf2e081861701d912a7a1365bc24c79a52c1ea122b05776aa47471f6d660d233d
            const result: string = ethers.utils.sha256(ethers.utils.toUtf8Bytes("the-result"));
            await iexecPocoBoostInstance.matchOrdersBoost(requestOrder, appOrder)
            await expect(iexecPocoBoostInstance.pushResultBoost(dealId, index, result))
                .to.emit(iexecPocoBoostInstance, "ResultPushedBoost")
                .withArgs(dealId, index, result);
        });

        it("Should not push result when deal not found", async function () {
            // No match order
            const badDealId: string =
                "0xff6973ffda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688aaaa"
            const result: string = ethers.utils.sha256(ethers.utils.toUtf8Bytes("the-result"));
            await expect(iexecPocoBoostInstance.pushResultBoost(badDealId, 0, result))
                .to.be.revertedWith("Deal not found");
        });
    });

    async function deployPocoBoostFixture() {
        await deployPocoNominal()
        console.log("Deploying IexecPocoBoostDelegate")
        const [owner, appProvider, otherAccount] = await hre.ethers.getSigners();
        const iexecPocoBoostInstance: IexecPocoBoostDelegate =
            await (await new IexecPocoBoostDelegate__factory()
                .connect(owner)
                .deploy())
                .deployed();
        console.log(`IexecPocoBoostDelegate successfully deployed at ${iexecPocoBoostInstance.address}`)
        const erc1538ProxyAddress = (await erc1538Proxy.deployed()).address;
        await linkBoostModule(erc1538ProxyAddress, owner, iexecPocoBoostInstance.address);
        // Expose hardhat AppRegistry instance
        const appRegistryInstance =
            AppRegistry__factory.connect(await getContractAddress('AppRegistry'), owner)
        const receipt = await appRegistryInstance.createApp(appProvider.address,
            "my-app",
            "APP_TYPE_0",
            constants.NULL.BYTES32,
            constants.NULL.BYTES32,
            constants.NULL.BYTES32)
            .then(tx => tx.wait())
        const events = extractEventsFromReceipt(receipt,
            appRegistryInstance.address, "Transfer")
        const appAddress = events[0].args['tokenId'].toHexString()
        return { iexecPocoBoostInstance, appAddress, owner, otherAccount };
    }

    async function linkBoostModule(erc1538ProxyAddress: string, owner,
        iexecPocoBoostInstanceAddress: string) {
        const erc1538: ERC1538Update = ERC1538Update__factory
            .connect(erc1538ProxyAddress, owner);
        console.log(`IexecInstance found at address: ${erc1538.address}`);
        // Link IexecPocoBoost methods to ERC1538Proxy
        await erc1538.updateContract(
            iexecPocoBoostInstanceAddress,
            getFunctionSignatures(IexecPocoBoostDelegate__factory.abi),
            'Linking ' + IexecPocoBoostDelegate__factory.name
        );
        // Verify linking on ERC1538Proxy
        const erc1538QueryInstance: ERC1538Query = ERC1538Query__factory
            .connect(erc1538ProxyAddress, owner);
        const functionCount = await erc1538QueryInstance.totalFunctions();
        console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
        await Promise.all(
            [...Array(functionCount.toNumber()).keys()].map(async (i) => {
                const [method, _, contract] = await erc1538QueryInstance.functionByIndex(i);
                if (contract == iexecPocoBoostInstanceAddress) {
                    console.log(`[${i}] ${contract} (IexecPocoBoostDelegate) ${method}`);
                }
            })
        );
    }
});

/**
 * Get address of contract deployed with hardhat-truffle.
 * @param contractName contract to retrieve
 * @returns deployed address
 */
async function getContractAddress(contractName: string): Promise<string> {
    return await ((await hre.artifacts.require(contractName)
        .deployed()).address);
}
