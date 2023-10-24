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

module.exports = {
    deploy: async function (contract, ...args) {
        const instance = await contract.new(...args);
        contract.setAsDeployed(instance);
        console.log("%s: %s", contract._json.contractName, instance.address);
        return instance;
    },
    link: async function (libraryInstance, contract) {
        const chainid = await web3.eth.net.getId();
        const instance = contract._json.networks[chainid];
        if (!instance) {
            await contract.link(libraryInstance);
        }
    },
};
