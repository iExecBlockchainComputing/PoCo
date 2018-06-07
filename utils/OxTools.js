const ethers = require('ethers');

module.exports = {
	signMarket: function(object, wallet, hashing)
	{
		object.sign = ethers.utils.splitSignature(web3.eth.sign(wallet, hashing(object)));
		return object
	},
	getDappOrderHash: function(marketplace, dappmarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'address',
			'uint256',
			'uint256',
			'bytes32',
		],[
			marketplace,
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			dappmarket.salt,
		]);
	},
	getDataOrderHash: function(marketplace, datamarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'address',
			'uint256',
			'uint256',
			'bytes32',
		],[
			marketplace,
			datamarket.data,
			datamarket.dataprice,
			datamarket.volume,
			datamarket.salt,
		]);
	},
	getPoolOrderHash: function(marketplace, poolmarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'address',
			'uint256',
			'uint256',
			'uint256',
			'uint256',
			'bytes32',
		],[
			marketplace,
			poolmarket.pool,
			poolmarket.poolprice,
			poolmarket.volume,
			poolmarket.category,
			poolmarket.trust,
			poolmarket.salt,
		]);
	},
	getUserOrderHash: function(marketplace, usermarket)
	{
		return ethers.utils.solidityKeccak256([
			'address',
			'address',
			'uint256',
			'address',
			'uint256',
			'address',
			'uint256',
			'uint256',
			'uint256',
			'address',
			'address',
			'address',
			'string',
			'bytes32',
		],[
			marketplace,
			usermarket.dapp,
			usermarket.dapppricemax,
			usermarket.data,
			usermarket.datapricemax,
			usermarket.pool,
			usermarket.poolpricemax,
			usermarket.category,
			usermarket.trust,
			usermarket.requester,
			usermarket.beneficiary,
			usermarket.callback,
			usermarket.params,
			usermarket.salt,
		]);
	},

};
