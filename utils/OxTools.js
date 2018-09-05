const ethers = require('ethers');

module.exports = {
	signObject: function(object, wallet, hashing)
	{
		object.sign = ethers.utils.splitSignature(web3.eth.sign(wallet, hashing(object)));
		return object
	},
	getFullHash: function(marketplace, partialHash, salt)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'bytes32',
			'bytes32',
		],[
			marketplace,
			partialHash,
			salt,
		]);

	},
	dappPartialHash: function(dappmarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'uint256',
			'uint256',
			'address',
			'address',
			'address',
		],[
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			dappmarket.datarestrict,
			dappmarket.poolrestrict,
			dappmarket.userrestrict,
		]);
	},
	dataPartialHash: function(datamarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'uint256',
			'uint256',
			'address',
			'address',
			'address',
		],[
			datamarket.data,
			datamarket.dataprice,
			datamarket.volume,
			datamarket.dapprestrict,
			datamarket.poolrestrict,
			datamarket.userrestrict,
		]);
	},
	poolPartialHash: function(poolmarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'uint256',
			'uint256',
			'uint256',
			'uint256',
			'uint256',
			'address',
			'address',
			'address',
		],[
			poolmarket.pool,
			poolmarket.poolprice,
			poolmarket.volume,
			poolmarket.category,
			poolmarket.trust,
			poolmarket.tag,
			poolmarket.dapprestrict,
			poolmarket.datarestrict,
			poolmarket.userrestrict,
		]);
	},
	userPartialHash: function(usermarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'uint256',
			'address',
			'uint256',
			'address',
			'uint256',
			'uint256',
			'uint256',
			'uint256',
			'address',
			'address',
			'address',
			'string',
		],[
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
		]);
	},
	authorizeHash: function(authorization)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'bytes32',
			'address',
		],[
			authorization.worker,
			authorization.woid,
			authorization.enclave,
		]);
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
