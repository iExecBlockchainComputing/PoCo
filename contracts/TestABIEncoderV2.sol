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
	struct Resource
	{
		address pointer;
		uint256 price;
	}
	struct DappOrder
	{
		// market
		address   dapp;
		uint256   dappprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sign;
	}
	struct DataOrder
	{
		// market
		address   data;
		uint256   dataprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sign;
	}
	struct PoolOrder
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
		signature sign;
	}
	struct UserOrder
	{
		// market
		address   dapp;
		uint256   dapppricemax;
		address   data;
		uint256   datapricemax;
		address   pool;
		uint256   poolpricemax;
		address   requester;
		// settings
		uint256   category;
		uint256   trust;
		address   beneficiary;
		address   callback;
		string    params;
		// extra
		bytes32   salt;
		signature sign;
	}






	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		CLAIMED,   // Failled consensus
		COMPLETED  // Concensus achieved
	}

	struct WorkOrder
	{
		WorkOrderStatusEnum status;

		// Ressources
		Resource dapp;
		Resource data;
		Resource pool;

		// execution settings
		uint256 category;
		uint256 trust;

		// execution details
		address requester;
		address beneficiary;
		address callback;
		string  params;

		// other settings
		uint256 workerStakeRatio;
		uint256 schedulerRewardRatio;
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

	/*
		// consensus
		mapping(address => Contribution) contributions;
		address[] contributors;

		bytes32 consensus;
		uint256 winnerCounter;
		uint256 revealCounter;

		// timers
		uint256 consensusDeadline;
		uint256 revealDeadline;
	*/
}





















contract Marketplace_ABIEncoderV2
{
	using SafeMathOZ for uint256;

	uint256 public constant POOL_STAKE_RATIO = 30;

	/**
	 * Marketplace data
	 */
	mapping(bytes32 => uint256             ) public m_consumed;
	mapping(bytes32 => Iexec0xLib.WorkOrder) public m_workorders;

	/**
	 * Events
	 */
	event OrdersMatched  (bytes32 dappHash,
	                      bytes32 dataHash,
	                      bytes32 poolHash,
	                      bytes32 userHash);
	event DappOrderClosed(bytes32 dappHash);
	event DataOrderClosed(bytes32 dataHash);
	event PoolOrderClosed(bytes32 poolHash);
	event UserOrderClosed(bytes32 userHash);

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
		Iexec0xLib.signature sign)
	public pure returns (bool)
	{
		return signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", hash), sign.v, sign.r, sign.s);
	}

	function getDappOrderHash(Iexec0xLib.DappOrder dapporder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			dapporder.dapp,
			dapporder.dappprice,
			dapporder.volume,
			// extra
			dapporder.salt
		);
	}
	function getDataOrderHash(Iexec0xLib.DataOrder dataorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			dataorder.data,
			dataorder.dataprice,
			dataorder.volume,
			// extra
			dataorder.salt
		);
	}
	function getPoolOrderHash(Iexec0xLib.PoolOrder poolorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			poolorder.pool,
			poolorder.poolprice,
			poolorder.volume,
			// settings
			poolorder.category,
			poolorder.trust,
			// extra
			poolorder.salt
		);
	}
	function getUserOrderHash(Iexec0xLib.UserOrder userorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			userorder.dapp,
			userorder.dapppricemax,
			userorder.data,
			userorder.datapricemax,
			userorder.pool,
			userorder.poolpricemax,
			// settings
			userorder.category,
			userorder.trust,
			userorder.requester,
			userorder.beneficiary,
			userorder.callback,
			userorder.params,
			// extra
			userorder.salt
		);
	}

	/**
	 * Marketplace methods
	 */
	function matchOrders(
		Iexec0xLib.DappOrder dapporder,
		Iexec0xLib.DataOrder dataorder,
		Iexec0xLib.PoolOrder poolorder,
		Iexec0xLib.UserOrder userorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */
		// computation environment
		require(userorder.category == poolorder.category );
		require(userorder.trust    == poolorder.trust    );

		// user allowed enugh ressources.
		require(userorder.dapppricemax >= dapporder.dappprice);
		require(userorder.datapricemax >= dataorder.dataprice);
		require(userorder.poolpricemax >= poolorder.poolprice);

		// pairing is valid
		require(userorder.dapp == dapporder.dapp);
		require(userorder.data == dataorder.data);
		require(userorder.pool == address(0)
		     || userorder.pool == poolorder.pool);

		/**
		 * Check orders authenticity
		 */

		// dapp
		bytes32 dapporderHash = getDappOrderHash(dapporder);
		require(isValidSignature(
			OwnableOZ(dapporder.dapp).m_owner(), // application owner
			dapporderHash,
			dapporder.sign
		));

		// data
		bytes32 dataorderHash = getDataOrderHash(dataorder);
		if (userorder.data != address(0)) // only check if dataset is enabled
		{
			require(isValidSignature(
				OwnableOZ(dataorder.data).m_owner(), // dataset owner
				dataorderHash,
				dataorder.sign
			));
		}

		// pool
		bytes32 poolorderHash = getPoolOrderHash(poolorder);
		require(isValidSignature(
		 	OwnableOZ(poolorder.pool).m_owner(), // workerpool owner
			poolorderHash,
			poolorder.sign
		));

		// user
		bytes32 userorderHash = getUserOrderHash(userorder);
		require(isValidSignature(
			userorder.requester,
			userorderHash,
			userorder.sign
		));

		/**
		 * Check and update availability
		 */
		require(m_consumed[dapporderHash] <  dapporder.volume);
		require(m_consumed[dataorderHash] <  dataorder.volume);
		require(m_consumed[poolorderHash] <  poolorder.volume);
		require(m_consumed[userorderHash] == 0);
		m_consumed[dapporderHash] = m_consumed[dapporderHash].add(1);
		m_consumed[dataorderHash] = m_consumed[dataorderHash].add(1);
		m_consumed[poolorderHash] = m_consumed[poolorderHash].add(1);
		m_consumed[userorderHash] = 1;

		/**
		 * Lock
		 */
		// TODO: lock funds

		/**
		 * Record
		 */
		Iexec0xLib.WorkOrder storage workorder = m_workorders[userorderHash];
		workorder.status               = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.dapp.pointer         = dapporder.dapp;
		workorder.dapp.price           = dapporder.dappprice;
		workorder.data.pointer         = dataorder.data;
		workorder.data.price           = dataorder.dataprice;
		workorder.pool.pointer         = poolorder.pool;
		workorder.pool.price           = poolorder.poolprice;
		workorder.category             = userorder.category;
		workorder.trust                = userorder.trust;
		workorder.requester            = userorder.requester;
		workorder.beneficiary          = userorder.beneficiary;
		workorder.callback             = userorder.callback;
		workorder.params               = userorder.params;
		workorder.workerStakeRatio     = 0; // TODO
		workorder.schedulerRewardRatio = 0; // TODO

		emit OrdersMatched(
			dapporderHash,
			dataorderHash,
			poolorderHash,
			userorderHash
		);
		return userorderHash;
	}

	function cancelDappOrder(Iexec0xLib.DappOrder dapporder)
	public returns (bool)
	{
		/**
		 * Only Dapp owner can cancel
		 */
		require(msg.sender == OwnableOZ(dapporder.dapp).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dapporderHash = getDappOrderHash(dapporder);
		require(isValidSignature(
			msg.sender, // dapp owner
			dapporderHash,
			dapporder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dapporderHash] = dapporder.volume;

		emit DappOrderClosed(dapporderHash);
		return true;
	}

	function cancelDataOrder(Iexec0xLib.DataOrder dataorder)
	public returns (bool)
	{
		/**
		 * Only dataset owner can cancel
		 */
		require(msg.sender == OwnableOZ(dataorder.data).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dataorderHash = getDataOrderHash(dataorder);
		require(isValidSignature(
			msg.sender, // dataset owner
			dataorderHash,
			dataorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dataorderHash] = dataorder.volume;

		emit DataOrderClosed(dataorderHash);
		return true;
	}

	function cancelPoolOrder(Iexec0xLib.PoolOrder poolorder)
	public returns (bool)
	{
		/**
		 * Only workerpool owner can cancel
		 */
		require(msg.sender == OwnableOZ(poolorder.pool).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 poolorderHash = getPoolOrderHash(poolorder);
		require(isValidSignature(
			msg.sender, // workerpool owner
			poolorderHash,
			poolorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[poolorderHash] = poolorder.volume;

		emit PoolOrderClosed(poolorderHash);
		return true;
	}

	function cancelUserOrder(Iexec0xLib.UserOrder userorder)
	public returns (bool)
	{
		/**
		 * Only requester can cancel
		 */
		require(msg.sender == userorder.requester);

		/**
		 * Check authenticity
		 */
		bytes32 userorderHash = getUserOrderHash(userorder);
		require(isValidSignature(
			msg.sender, // requester
			userorderHash,
			userorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[userorderHash] = 1;

		emit UserOrderClosed(userorderHash);
		return true;
	}
}

















/*
contract MarketFactory
{
	struct Agent
	{
		address reference;
		uint256 price;
	}
	struct WorkOrder
	{
		WorkOrderStatusEnum status;
		Agent   dapp;
		Agent   data;
		Agent   pool;
		// execution settings
		uint256 category;
		uint256 trust;
		// execution details
		address requester;
		address beneficiary;
		address callback;
		string  params;
		// other settings
		uint256 workerStakeRatio;
		uint256 schedulerRewardRatio;
	}

	using SafeMathOZ for uint256;

	Marketplace_ABIEncoderV2 marketplace;

	mapping(bytes32 => WorkOrder) public m_workorders;

	constructor() public
	{
	}

	function initialize(
		Iexec0xLib.DappOrder dapporder,
		Iexec0xLib.DataOrder dataorder,
		Iexec0xLib.PoolOrder poolorder,
		Iexec0xLib.UserOrder userorder)
	public returns (uint256)
	{
		bytes32 woid = marketplace.matchOrders(dapporder, dataorder, poolorder, userorder);

		Iexec0xLib.WorkOrder memory workorder = m_workorders[woid];
		workorder.status               = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.dapp                 = dapporder.dapp;
		workorder.dappprice            = dapporder.dappprice;
		workorder.data                 = dataorder.data;
		workorder.dataprice            = dataorder.dataprice;
		workorder.pool                 = poolorder.pool;
		workorder.poolprice            = poolorder.poolprice;
		workorder.category             = userorder.category;
		workorder.trust                = userorder.trust;
		workorder.requester            = userorder.requester;
		workorder.beneficiary          = userorder.beneficiary;
		workorder.callback             = userorder.callback;
		workorder.params               = userorder.params;
		workorder.workerStakeRatio     = 0;
		workorder.schedulerRewardRatio = 0;
	}
}
*/
