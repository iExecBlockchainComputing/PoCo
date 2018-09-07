// const ethers = require('ethers');

module.exports = {
	signObject: function(object, wallet, hashing)
	{
		return web3.eth.sign(hashing(object), wallet).then(function(signature) {
			// object.sign = ethers.utils.splitSignature(signature);
			object.sign = {
				r:             "0x" + signature.substr( 2, 64),
				s:             "0x" + signature.substr(66, 64),
				v: 27 + Number("0x" + signature.substr(    -2)),
			};
			return object
		});
	},
	getFullHash: function(iexecclerk, partialHash, salt)
	{
		return web3.utils.soliditySha3(
			iexecclerk,
			partialHash,
			salt,
		);
	},
	dappPartialHash: function(dappmarket)
	{
		return web3.utils.soliditySha3(
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			dappmarket.datarestrict,
			dappmarket.poolrestrict,
			dappmarket.userrestrict,
		);
	},
	dataPartialHash: function(datamarket)
	{
		return web3.utils.soliditySha3(
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			dappmarket.datarestrict,
			dappmarket.poolrestrict,
			dappmarket.userrestrict,
		);
	},
	poolPartialHash: function(poolmarket)
	{
		return web3.utils.soliditySha3(
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			dappmarket.datarestrict,
			dappmarket.poolrestrict,
			dappmarket.userrestrict,
		);
	},
	userPartialHash: function(usermarket)
	{
		return web3.utils.soliditySha3(
				usermarket.dapp,
				usermarket.dappmaxprice,
				usermarket.data,
				usermarket.datamaxprice,
				usermarket.pool,
				usermarket.poolmaxprice,
				usermarket.category,
				usermarket.trust,
				usermarket.tag,
				usermarket.requester,
				usermarket.beneficiary,
				usermarket.callback,
				usermarket.params,
		);
	},
	authorizeHash: function(authorization)
	{
		return web3.utils.soliditySha3(
			authorization.worker,
			authorization.woid,
			authorization.enclave,
		);
	},





	hashByteResult: function(byteresult)
	{
		const resultHash    = web3.sha3(byteresult,  {encoding: 'hex'}); // Vote
		return { base: byteresult, contribution: {hash: resultHash }};
	},
	signByteResult: function(byteresult, address)
	{
		const resultHash    = web3.sha3(byteresult, {encoding: 'hex'}); // Vote
		const addressHash   = web3.sha3(address,    {encoding: 'hex'});
		var   xor           = '0x';
		for(i=2; i<66; ++i) xor += (parseInt(byteresult.charAt(i), 16) ^ parseInt(addressHash.charAt(i), 16)).toString(16); // length 64, with starting 0x
		const sign          = web3.sha3(xor, {encoding: 'hex'}); // Sign
		return { base: byteresult, contribution: {hash: resultHash, sign: sign }};
	},
	hashResult: function(result)          { return this.hashByteResult(web3.sha3(result)         ); },
	signResult: function(result, address) { return this.signByteResult(web3.sha3(result), address); },

};
