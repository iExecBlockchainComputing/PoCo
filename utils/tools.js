// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const { ethers } = require('ethers');

function _extractEvents(data, address, name) {
    const events = data.filter((ev) => {
        return ev.address == address && ev.event == name;
    });
    assert.isNotEmpty(events, `Fail to extract '${name}' event`);
    return events;
}

module.exports = {
    extractEvents: function (txMined, address, name) {
        return _extractEvents(txMined.logs, address, name);
    },

    extractEventsFromReceipt: function (txReceipt, address, name) {
        return _extractEvents(txReceipt.events, address, name);
    },

    BN2Address: function (n) {
        const x = web3.utils.toHex(n);
        return web3.utils.toChecksumAddress('0x' + '0'.repeat(42 - x.length) + x.slice(2));
    },

    create2: function (creator, code, salt) {
        return web3.utils.toChecksumAddress(
            web3.utils
                .soliditySha3(
                    { t: 'bytes1', v: '0xff' },
                    { t: 'address', v: creator },
                    { t: 'bytes32', v: salt },
                    { t: 'bytes32', v: web3.utils.keccak256(code) },
                )
                .slice(26),
        );
    },

    compactSignature: function (signature) {
        let split = ethers.utils.splitSignature(signature);
        let vs = ethers.utils.arrayify(split.s);
        if (split.v == 1 || split.v == 28) {
            vs[0] |= 0x80;
        }
        return ethers.utils.hexlify(ethers.utils.concat([split.r, vs]));
    },
};
