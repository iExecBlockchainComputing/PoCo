module.exports = {
	extractEvents: function(txMined, address, name)
	{
		return txMined.logs.filter((ev) => { return ev.address == address && ev.event == name });
	},

	BN2Address: function(n)
	{
		const x = web3.utils.toHex(n)
		return web3.utils.toChecksumAddress('0x' + "0".repeat(42 - x.length) + x.slice(2))
	}
};
