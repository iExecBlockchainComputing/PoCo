// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

var ENSRegistry = artifacts.require('@ensdomains/ens-contracts/contracts/registry/ENSRegistry');
var PublicResolver = artifacts.require(
    '@ensdomains/ens-contracts/contracts/resolvers/PublicResolver',
);

module.exports = {
    labelhash: function (label) {
        return web3.utils.keccak256(label.toLowerCase());
    },

    compose: function (labelHash, rootHash) {
        return web3.utils.keccak256(
            web3.eth.abi.encodeParameters(['bytes32', 'bytes32'], [rootHash, labelHash]),
        );
    },

    namehash: function (domain) {
        return domain
            .split('.')
            .reverse()
            .reduce(
                (hash, label) => this.compose(this.labelhash(label), hash),
                '0x0000000000000000000000000000000000000000000000000000000000000000',
            );
    },

    resolve: async function (name) {
        node = this.namehash(name);
        registry = await ENSRegistry.deployed();
        resolveraddr = await registry.resolver(node);
        resolver = await PublicResolver.at(resolveraddr);
        addr = await resolver.addr(node);
        return addr;
    },

    lookup: async function (addr) {
        node = this.namehash(`${addr.substring(2)}.addr.reverse`);
        registry = await ENSRegistry.deployed();
        resolveraddr = await registry.resolver(node);
        resolver = await PublicResolver.at(resolveraddr);
        name = await resolver.name(node);
        return name;
    },
};
