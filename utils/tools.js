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

const { ethers } = require('ethers');

module.exports = {
	extractEvents: function(txMined, address, name)
	{
		return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
	},

	BN2Address: function(n)
	{
		const x = web3.utils.toHex(n)
		return web3.utils.toChecksumAddress('0x' + "0".repeat(42 - x.length) + x.slice(2))
	},

	create2: function(creator, code, salt)
	{
		return web3.utils.toChecksumAddress(web3.utils.soliditySha3(
			{ t: 'bytes1',  v: '0xff'                     },
			{ t: 'address', v: creator                    },
			{ t: 'bytes32', v: salt                       },
			{ t: 'bytes32', v: web3.utils.keccak256(code) },
		).slice(26));
	},

	compactSignature: function(signature)
	{
		let split = ethers.utils.splitSignature(signature);
		let vs    = ethers.utils.arrayify(split.s);
		if (split.v == 1 || split.v == 28) { vs[0] |= 0x80; }
		return ethers.utils.hexlify(ethers.utils.concat([ split.r, vs ]));
	},

};
