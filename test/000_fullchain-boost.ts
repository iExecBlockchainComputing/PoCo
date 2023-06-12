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
import { ethers } from "hardhat";
import {
    IexecPocoBoostDelegate__factory, IexecPocoBoostDelegate,
    ERC1538Update__factory, ERC1538Update,
    ERC1538Query__factory, ERC1538Query
} from "../typechain";
import deployPocoNominal from "./truffle-fixture";
import { getFunctionSignatures } from "../migrations/utils/getFunctionSignatures";

describe("IexecPocoBoostDelegate", function () {
    let iexecPocoBoostInstance: IexecPocoBoostDelegate;

    beforeEach("Deploy IexecPocoBoostDelegate", async () => {
        // We define a fixture to reuse the same setup in every test.
        // We use loadFixture to run this setup once, snapshot that state,
        // and reset Hardhat Network to that snapshot in every test.
        iexecPocoBoostInstance =
            (await loadFixture(deployPocoBoostFixture)).iexecPocoBoostInstance
    });

    describe("MatchOrders", function () {
        it("Should match orders", async function () {
            const expectedDealId =
                "0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f";
            await expect(iexecPocoBoostInstance.matchOrdersBoost(1, 1))
                .to.emit(iexecPocoBoostInstance, "OrdersMatchedBoost")
                .withArgs(expectedDealId);
            expect((await iexecPocoBoostInstance.viewDealBoost(expectedDealId)).tag)
                .is.equal("0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6")
        });

        it("Should not match orders", async function () {
            await expect(iexecPocoBoostInstance.matchOrdersBoost(0, 1))
                .to.be.revertedWith("Incompatible request and app orders");
        });
    });




    async function deployPocoBoostFixture() {
        const erc1538ProxyAddress = await deployPocoNominal()
        console.log("Deploying IexecPocoBoostDelegate")
        const [owner, otherAccount] = await ethers.getSigners();
        const iexecPocoBoostInstance: IexecPocoBoostDelegate =
            await (await new IexecPocoBoostDelegate__factory()
                .connect(owner)
                .deploy())
                .deployed();
        console.log(`IexecPocoBoostDelegate successfully deployed at ${iexecPocoBoostInstance.address}`)
        await linkBoostModule(erc1538ProxyAddress, owner, iexecPocoBoostInstance.address);
        return { iexecPocoBoostInstance, owner, otherAccount };
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
