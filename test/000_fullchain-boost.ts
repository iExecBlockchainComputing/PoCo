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
    IexecPocoBoostDelegate__factory,
    ERC1538Update__factory,
    ERC1538Query__factory,
} from "../typechain";
import deployPocoNominal from "./truffle-fixture";
import { getFunctionSignatures } from "../migrations/utils/getFunctionSignatures";

describe("IexecPocoBoostDelegate", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployPocoBoostFixture() {
        await deployPocoNominal()
        console.log("Deploying IexecPocoBoostDelegate")
        const [owner, otherAccount] = await ethers.getSigners();
        const iexecPocoBoostFactory = await new IexecPocoBoostDelegate__factory()
            .connect(owner)
            .deploy();
        const iexecPocoBoost = await iexecPocoBoostFactory.deployed();
        console.log(`IexecPocoBoostDelegate successfully deployed at ${iexecPocoBoost.address}`)

        //TODO: Read ERC1538Proxy address dynamically
        const erc1538ProxyAddress = "0x977483a6ED002AFd098E95Be7434445fF1b122ff";
        const erc1538 = ERC1538Update__factory
            .connect(erc1538ProxyAddress, owner);
        console.log(`IexecInstance found at address: ${erc1538.address}`);
        // Link IexecPocoBoost methods to ERC1538Proxy
        await erc1538.updateContract(
            (await iexecPocoBoost.deployed()).address,
            getFunctionSignatures(IexecPocoBoostDelegate__factory.abi),
            'Linking ' + IexecPocoBoostDelegate__factory.name
        );
        // Verify linking on ERC1538Proxy
        const erc1538QueryInstance = ERC1538Query__factory
            .connect(erc1538ProxyAddress, owner);
        const functionCount = await erc1538QueryInstance.totalFunctions();
        console.log(`The deployed ERC1538Proxy now supports ${functionCount} functions:`);
        await Promise.all(
            [...Array(functionCount.toNumber()).keys()].map(async i => {
                const [method, _, contract] =
                    await erc1538QueryInstance.functionByIndex(i)
                if (contract == (await iexecPocoBoost.deployed()).address) {
                    console.log(`[${i}] ${contract} (IexecPocoBoostDelegate) ${method}`)
                }
            })
        );
        return { iexecPocoBoost, owner, otherAccount };
    }

    describe("MatchOrders", function () {
        it("Should match orders", async function () {
            const { iexecPocoBoost } = await loadFixture(deployPocoBoostFixture);
            const expectedDealId =
                "0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f";
            await expect(iexecPocoBoost.matchOrders(1, 1))
                .to.emit(iexecPocoBoost, "OrdersMatched")
                .withArgs(expectedDealId);
            expect((await iexecPocoBoost.viewDeal(expectedDealId)).tag)
                .is.equal("0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6")
        });

        it("Should not match orders", async function () {
            const { iexecPocoBoost } = await loadFixture(deployPocoBoostFixture);
            await expect(iexecPocoBoost.matchOrders(0, 1)).to.be.revertedWith(
                "Incompatible request and app orders"
            );
        });
    });
});
