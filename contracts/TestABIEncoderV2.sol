pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./SafeMathOZ.sol";
import "./OwnableOZ.sol";

library Iexec0xLib
{
	/**
	 * Structures
	 */
	struct signature
	{
		uint8   v;
		bytes32 r;
		bytes32 s;
	}
	struct DappMarket
	{
		// market
		address   dapp;
		uint256   dappprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sig;
	}
	struct DataMarket
	{
		// market
		address   data;
		uint256   dataprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sig;
	}
	struct PoolMarket
	{
		// market
		address   pool;
		uint256   poolprice;
		uint256   volume;
		// settings
		uint256   category;
		uint256   trust;
		// extra
		bytes32   salt;
		signature sig;
	}
	struct UserMarket
	{
		// market
		address   dapp;
		uint256   dappprice;
		address   data;
		uint256   dataprice;
		address   pool;
		uint256   poolprice;
		address   requester;
		// settings
		uint256   category;
		uint256   trust;
		address   beneficiary;
		address   callback;
		string    params;
		// extra
		bytes32   salt;
		signature sig;
	}






	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		CLAIMED,   // Failled consensus
		COMPLETED  // Concensus achieved
	}

	enum ContributionStatusEnum
	{
		UNSET,
		AUTHORIZED,
		CONTRIBUTED,
		PROVED,
		REJECTED
	}
	struct Contribution
	{
		ContributionStatusEnum status;
		bytes32                resultHash;
		bytes32                resultSign;
		address                enclaveChallenge;
		uint256                score;
		uint256                weight;
	}
}




contract WorkOrder
{
	using SafeMathOZ for uint256;

	/**
	 * Market
	 */
	Iexec0xLib.WorkOrderStatusEnum status;
	// common
	uint256 category;
	uint256 trust;
	// workerpool
	address workerpool;
	address workerpoolOwner;
	uint256 workerpoolReward;
	// app
	address app;
	uint256 appReward;
	// dataset
	address dataset;
	uint256 datasetReward;
	// execution
	address requester;
	address beneficiary;
	address callback;
	string  params;

	/**
	 * Worker pool settings
	 */
	uint256 workerStakeRatio;
	uint256 schedulerRewardRatio;

	/**
	 * Consensus
	 */
	mapping(address => Iexec0xLib.Contribution) contributions;
	address[] contributors;

	bytes32 consensus;
	uint256 winnerCounter;
	uint256 revealCounter;

	/**
	 * Timers
	 */
	uint256 consensusDeadline;
	uint256 revealDeadline;




	modifier onlyWorkerPool
	{
		require(msg.sender == workerpool);
		_;
	}

	/**
	 * Constructor
	 */
	/*
	constructor(
		Iexec0xLib.PoolMarket _poolmarket,
		Iexec0xLib.UserMarket _usermarket)
	public
	{
		status           = Iexec0xLib.WorkOrderStatusEnum.UNSET;
		category         = _poolmarket.category;
		trust            = _poolmarket.trust;
		workerpool       = _poolmarket.workerpool;
		workerpoolOwner  = OwnableOZ(workerpool).m_owner();
		workerpoolReward = _poolmarket.workerpoolprice;
		app              = _usermarket.app;
		// if (app     != address(0)) { appReward      = App(app).price();         }
		dataset          = _usermarket.dataset;
		// if (dataset != address(0)) { datasetReward  = Dataset(dataset).price(); }
		requester        = _usermarket.requester;
		beneficiary      = _usermarket.beneficiary;
		callback         = _usermarket.callback;
		params           = _usermarket.params;
	}

	function initialize(
		uint256 _workerStakeRatio,
		uint256 _schedulerRewardRatio,
		uint256 _consensusDeadline)
	public onlyWorkerPool returns (bool)
	{
		require(status == Iexec0xLib.WorkOrderStatusEnum.UNSET);
		status = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;

		workerStakeRatio     = _workerStakeRatio;
		schedulerRewardRatio = _schedulerRewardRatio;
		consensusDeadline    = _consensusDeadline;
	}
	*/


}













contract TestABIEncoderV2
{
	using SafeMathOZ for uint256;

	/**
	 * Marketplace data
	 */
	mapping(bytes32 => uint256) m_consumed;

	uint256 public constant POOL_STAKE_RATIO = 30;

	/**
	 * Events
	 */
	event MarketsMatched  (bytes32 poolHash, bytes32 userHash);
	event PoolMarketClosed(bytes32 poolHash);
	event UserMarketClosed(bytes32 userHash);

	/**
	 * Constructor
	 */
	constructor() public
	{
	}

	/**
	 * Hashing and signature tools
	 */
	function isValidSignature(
		address              signer,
		bytes32              hash,
		Iexec0xLib.signature sig)
	public pure returns (bool)
	{
		return signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", hash), sig.v, sig.r, sig.s);
	}


	function getDappMarketHash(Iexec0xLib.DappMarket dappmarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			dappmarket.dapp,
			dappmarket.dappprice,
			dappmarket.volume,
			// extra
			dappmarket.salt
		);
	}
	function getDataMarketHash(Iexec0xLib.DataMarket datamarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			datamarket.data,
			datamarket.dataprice,
			datamarket.volume,
			// extra
			datamarket.salt
		);
	}
	function getPoolMarketHash(Iexec0xLib.PoolMarket poolmarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			poolmarket.pool,
			poolmarket.poolprice,
			poolmarket.volume,
			// settings
			poolmarket.category,
			poolmarket.trust,
			// extra
			poolmarket.salt
		);
	}
	function getUserMarketHash(Iexec0xLib.UserMarket usermarket)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			usermarket.dapp,
			usermarket.dappprice,
			usermarket.data,
			usermarket.dataprice,
			usermarket.pool,
			usermarket.poolprice,
			usermarket.requester,
			// settings
			usermarket.category,
			usermarket.trust,
			usermarket.beneficiary,
			usermarket.callback,
			usermarket.params,
			// extra
			usermarket.salt
		);
	}


	/**
	 * Marketplace methods
	 */

	function test() public returns(bool) { return true; }

	function matchOrders(
		Iexec0xLib.DappMarket dappmarket,
		Iexec0xLib.DataMarket datamarket,
		Iexec0xLib.PoolMarket poolmarket,
		Iexec0xLib.UserMarket usermarket)
	public view returns (bool)
	{
		/**
		 * Check compatibility
		 */
		require(usermarket.category  == poolmarket.category );
		require(usermarket.trust     == poolmarket.trust    );

		require(usermarket.dappprice == dappmarket.dappprice);
		require(usermarket.dataprice == datamarket.dataprice);
		require(usermarket.poolprice == poolmarket.poolprice);

		require(usermarket.dapp      == dappmarket.dapp     );
		require(usermarket.data      == datamarket.data     );
		require(usermarket.pool      == address(0)
		     || usermarket.pool      == poolmarket.pool     );

		/**
		 * Check authenticity
		 */
		bytes32 dappmarketHash = getDappMarketHash(dappmarket);
		bytes32 datamarketHash = getDataMarketHash(datamarket);
		bytes32 poolmarketHash = getPoolMarketHash(poolmarket);
		bytes32 usermarketHash = getUserMarketHash(usermarket);
		require(isValidSignature(
		 	OwnableOZ(dappmarket.dapp).m_owner(), // application owner
			dappmarketHash,
			dappmarket.sig
		));
		if (usermarket.data != address(0)) // only check if dataset is enabled
		{
			require(isValidSignature(
				OwnableOZ(datamarket.data).m_owner(), // dataset owner
				datamarketHash,
				datamarket.sig
			));
		}
		require(isValidSignature(
		 	OwnableOZ(poolmarket.pool).m_owner(), // workerpool owner
			poolmarketHash,
			poolmarket.sig
		));
		require(isValidSignature(
			usermarket.requester,
			usermarketHash,
			usermarket.sig
		));

		/**
		 * Check and update availability
		 */
		require(m_consumed[poolmarketHash] <  poolmarket.volume);
		require(m_consumed[usermarketHash] == 0);
		// m_consumed[poolmarketHash] = m_consumed[poolmarketHash].add(1);
		// m_consumed[usermarketHash] = 1;

		/**
		 * Lock
		 */
		// TODO: lock funds

		// emit MarketsMatched(poolmarketHash, usermarketHash);
		return true;
	}

	function cancelPoolMarket(Iexec0xLib.PoolMarket poolmarket)
	public returns (bool)
	{
		/**
		 * Only workerpool owner can cancel
		 */
		require(msg.sender == OwnableOZ(poolmarket.pool).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 poolmarketHash = getPoolMarketHash(poolmarket);
		require(isValidSignature(
			msg.sender, // workerpool owner
			poolmarketHash,
			poolmarket.sig
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[poolmarketHash] = poolmarket.volume;

		emit PoolMarketClosed(poolmarketHash);
		return true;
	}

	function cancelUserMarket(Iexec0xLib.UserMarket usermarket)
	public returns (bool)
	{
		/**
		 * Only requester can cancel
		 */
		require(msg.sender == usermarket.requester);

		/**
		 * Check authenticity
		 */
		bytes32 usermarketHash = getUserMarketHash(usermarket);
		require(isValidSignature(
			msg.sender, // requester
			usermarketHash,
			usermarket.sig
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[usermarketHash] = 1;

		emit UserMarketClosed(usermarketHash);
		return true;
	}

}
