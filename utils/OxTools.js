const ethers = require('ethers');

module.exports = {
	signMarket: function(object, wallet, hashing)
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

};
