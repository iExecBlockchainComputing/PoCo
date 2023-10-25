// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH

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
