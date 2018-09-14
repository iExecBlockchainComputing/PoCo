module.exports = {
	signObject: function(object, wallet, hashing)
	{
		return web3.eth.sign(hashing(object), wallet).then(function(signature) {
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
			{ t: 'address', v: iexecclerk  },
			{ t: 'bytes32', v: partialHash },
			{ t: 'bytes32', v: salt        },
		);
	},
	dappPartialHash: function(dappmarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: dappmarket.dapp         },
			{ t: 'uint256', v: dappmarket.dappprice    },
			{ t: 'uint256', v: dappmarket.volume       },
			{ t: 'address', v: dappmarket.datarestrict },
			{ t: 'address', v: dappmarket.poolrestrict },
			{ t: 'address', v: dappmarket.userrestrict },
		);
	},
	dataPartialHash: function(datamarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: datamarket.data         },
			{ t: 'uint256', v: datamarket.dataprice    },
			{ t: 'uint256', v: datamarket.volume       },
			{ t: 'address', v: datamarket.dapprestrict },
			{ t: 'address', v: datamarket.poolrestrict },
			{ t: 'address', v: datamarket.userrestrict },
		);
	},
	poolPartialHash: function(poolmarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: poolmarket.pool         },
			{ t: 'uint256', v: poolmarket.poolprice    },
			{ t: 'uint256', v: poolmarket.volume       },
			{ t: 'uint256', v: poolmarket.category     },
			{ t: 'uint256', v: poolmarket.trust        },
			{ t: 'uint256', v: poolmarket.tag          },
			{ t: 'address', v: poolmarket.dapprestrict },
			{ t: 'address', v: poolmarket.datarestrict },
			{ t: 'address', v: poolmarket.userrestrict },
		);
	},
	userPartialHash: function(usermarket)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: usermarket.dapp         },
			{ t: 'uint256', v: usermarket.dappmaxprice },
			{ t: 'address', v: usermarket.data         },
			{ t: 'uint256', v: usermarket.datamaxprice },
			{ t: 'address', v: usermarket.pool         },
			{ t: 'uint256', v: usermarket.poolmaxprice },
			{ t: 'uint256', v: usermarket.volume       },
			{ t: 'uint256', v: usermarket.category     },
			{ t: 'uint256', v: usermarket.trust        },
			{ t: 'uint256', v: usermarket.tag          },
			{ t: 'address', v: usermarket.requester    },
			{ t: 'address', v: usermarket.beneficiary  },
			{ t: 'address', v: usermarket.callback     },
			{ t: 'string',  v: usermarket.params       },
		);
	},
	authorizeHash: function(authorization)
	{
		return web3.utils.soliditySha3(
			{ t: 'address', v: authorization.worker  },
			{ t: 'bytes32', v: authorization.woid    },
			{ t: 'address', v: authorization.enclave },
		);
	},
	contributionHash: function(result)
	{
		return web3.utils.soliditySha3(
			{ t: 'bytes32', v: result.contribution.hash },
			{ t: 'bytes32', v: result.contribution.sign },
		);
	},
	hashByteResult: function(byteresult)
	{
		return {
			base: byteresult,
			contribution: {
				hash: web3.utils.soliditySha3({ t: 'bytes32', v: byteresult })
			}
		};
	},
	signByteResult: function(byteresult, address)
	{
		return {
			base: byteresult,
			contribution: {
				hash: web3.utils.soliditySha3(                              { t: 'bytes32', v: byteresult }),
				sign: web3.utils.soliditySha3({ t: 'address', v: address }, { t: 'bytes32', v: byteresult })
			}
		};
	},
	hashResult: function(result)          { return this.hashByteResult(web3.utils.soliditySha3({t: 'string', v: result })         ); },
	signResult: function(result, address) { return this.signByteResult(web3.utils.soliditySha3({t: 'string', v: result }), address); },

};
