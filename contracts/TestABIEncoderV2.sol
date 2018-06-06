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

	struct Resource
	{
		address pointer;
		address owner;
		uint256 price;
	}
	struct Deal
	{
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







	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		COMPLETED, // Concensus achieved
		FAILLED    // Failled consensus
	}
	struct WorkOrder
	{
		WorkOrderStatusEnum status;
		bytes32   consensusValue;
		uint256   consensusDeadline;
		uint256   revealDeadline;
		uint256   revealCounter;
		uint256   winnerCounter;
		address[] contributors;
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
		bytes32 resultHash;
		bytes32 resultSign;
		address enclaveChallenge;
		uint256 score;
		uint256 weight;
	}

}






contract Marketplace_ABIEncoderV2
{
	using SafeMathOZ for uint256;

	uint256 public constant POOL_STAKE_RATIO = 30;

	/**
	 * Marketplace data
	 */
	mapping(bytes32 => uint256        ) public m_consumed;
	mapping(bytes32 => Iexec0xLib.Deal) public m_deals;

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



	function viewDeal(bytes32 _id)
	public view returns(Iexec0xLib.Deal)
	{
		return m_deals[_id];
	}

	/**
	 * Hashing and signature tools
	 */
	function isValidSignature(
		address              _signer,
		bytes32              _hash,
		Iexec0xLib.signature _signature)
	public pure returns (bool)
	{
		return _signer == ecrecover(keccak256("\x19Ethereum Signed Message:\n32", _hash), _signature.v, _signature.r, _signature.s);
	}

	function getDappOrderHash(Iexec0xLib.DappOrder _dapporder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_dapporder.dapp,
			_dapporder.dappprice,
			_dapporder.volume,
			// extra
			_dapporder.salt
		);
	}
	function getDataOrderHash(Iexec0xLib.DataOrder _dataorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_dataorder.data,
			_dataorder.dataprice,
			_dataorder.volume,
			// extra
			_dataorder.salt
		);
	}
	function getPoolOrderHash(Iexec0xLib.PoolOrder _poolorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_poolorder.pool,
			_poolorder.poolprice,
			_poolorder.volume,
			// settings
			_poolorder.category,
			_poolorder.trust,
			// extra
			_poolorder.salt
		);
	}
	function getUserOrderHash(Iexec0xLib.UserOrder _userorder)
	public view returns (bytes32)
	{
		return keccak256(
			address(this),
			// market
			_userorder.dapp,
			_userorder.dapppricemax,
			_userorder.data,
			_userorder.datapricemax,
			_userorder.pool,
			_userorder.poolpricemax,
			// settings
			_userorder.category,
			_userorder.trust,
			_userorder.requester,
			_userorder.beneficiary,
			_userorder.callback,
			_userorder.params,
			// extra
			_userorder.salt
		);
	}

	/**
	 * Marketplace methods
	 */
	function matchOrders(
		Iexec0xLib.DappOrder _dapporder,
		Iexec0xLib.DataOrder _dataorder,
		Iexec0xLib.PoolOrder _poolorder,
		Iexec0xLib.UserOrder _userorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */
		// computation environment
		require(_userorder.category == _poolorder.category );
		require(_userorder.trust    == _poolorder.trust    );

		// user allowed enugh ressources.
		require(_userorder.dapppricemax >= _dapporder.dappprice);
		require(_userorder.datapricemax >= _dataorder.dataprice);
		require(_userorder.poolpricemax >= _poolorder.poolprice);

		// pairing is valid
		require(_userorder.dapp == _dapporder.dapp);
		require(_userorder.data == _dataorder.data);
		require(_userorder.pool == address(0)
		     || _userorder.pool == _poolorder.pool);

		/**
		 * Check orders authenticity
		 */

		// dapp
		bytes32 dapporderHash = getDappOrderHash(_dapporder);
		address dappowner     = OwnableOZ(_dapporder.dapp).m_owner(); // application owner
		require(isValidSignature(dappowner, dapporderHash, _dapporder.sign));

		// data
		bytes32 dataorderHash = getDataOrderHash(_dataorder);
		address dataowner     = 0;
		if (_dataorder.data != address(0)) // only check if dataset is enabled
		{
			dataowner = OwnableOZ(_dataorder.data).m_owner(); // dataset owner
			require(isValidSignature(dataowner, dataorderHash, _dataorder.sign));
		}

		// pool
		bytes32 poolorderHash = getPoolOrderHash(_poolorder);
		address poolowner     = OwnableOZ(_poolorder.pool).m_owner(); // workerpool owner
		require(isValidSignature(poolowner, poolorderHash, _poolorder.sign));

		// user
		bytes32 userorderHash = getUserOrderHash(_userorder);
		require(isValidSignature(_userorder.requester, userorderHash, _userorder.sign));

		/**
		 * Check and update availability
		 */
		require(m_consumed[dapporderHash] <  _dapporder.volume);
		require(m_consumed[dataorderHash] <  _dataorder.volume);
		require(m_consumed[poolorderHash] <  _poolorder.volume);
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
		Iexec0xLib.Deal storage deal = m_deals[userorderHash];
		deal.dapp.pointer         = _dapporder.dapp;
		deal.dapp.owner           = dappowner;
		deal.dapp.price           = _dapporder.dappprice;
		deal.data.owner           = dataowner;
		deal.data.pointer         = _dataorder.data;
		deal.data.price           = _dataorder.dataprice;
		deal.pool.pointer         = _poolorder.pool;
		deal.pool.owner           = poolowner;
		deal.pool.price           = _poolorder.poolprice;
		deal.category             = _userorder.category;
		deal.trust                = _userorder.trust;
		deal.requester            = _userorder.requester;
		deal.beneficiary          = _userorder.beneficiary;
		deal.callback             = _userorder.callback;
		deal.params               = _userorder.params;
		deal.workerStakeRatio     = 0; // TODO
		deal.schedulerRewardRatio = 0; // TODO

		emit OrdersMatched(
			dapporderHash,
			dataorderHash,
			poolorderHash,
			userorderHash
		);
		return userorderHash;
	}

	function cancelDappOrder(Iexec0xLib.DappOrder _dapporder)
	public returns (bool)
	{
		/**
		 * Only Dapp owner can cancel
		 */
		require(msg.sender == OwnableOZ(_dapporder.dapp).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dapporderHash = getDappOrderHash(_dapporder);
		require(isValidSignature(
			msg.sender, // dapp owner
			dapporderHash,
			_dapporder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dapporderHash] = _dapporder.volume;

		emit DappOrderClosed(dapporderHash);
		return true;
	}

	function cancelDataOrder(Iexec0xLib.DataOrder _dataorder)
	public returns (bool)
	{
		/**
		 * Only dataset owner can cancel
		 */
		require(msg.sender == OwnableOZ(_dataorder.data).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 dataorderHash = getDataOrderHash(_dataorder);
		require(isValidSignature(
			msg.sender, // dataset owner
			dataorderHash,
			_dataorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[dataorderHash] = _dataorder.volume;

		emit DataOrderClosed(dataorderHash);
		return true;
	}

	function cancelPoolOrder(Iexec0xLib.PoolOrder _poolorder)
	public returns (bool)
	{
		/**
		 * Only workerpool owner can cancel
		 */
		require(msg.sender == OwnableOZ(_poolorder.pool).m_owner());

		/**
		 * Check authenticity
		 */
		bytes32 poolorderHash = getPoolOrderHash(_poolorder);
		require(isValidSignature(
			msg.sender, // workerpool owner
			poolorderHash,
			_poolorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[poolorderHash] = _poolorder.volume;

		emit PoolOrderClosed(poolorderHash);
		return true;
	}

	function cancelUserOrder(Iexec0xLib.UserOrder _userorder)
	public returns (bool)
	{
		/**
		 * Only requester can cancel
		 */
		require(msg.sender == _userorder.requester);

		/**
		 * Check authenticity
		 */
		bytes32 userorderHash = getUserOrderHash(_userorder);
		require(isValidSignature(
			msg.sender, // requester
			userorderHash,
			_userorder.sign
		));

		/**
		 * Cancel market by marking it consumed
		 */
		m_consumed[userorderHash] = 1;

		emit UserOrderClosed(userorderHash);
		return true;
	}
}






























contract ConsensusesManager
{
	using SafeMathOZ for uint256;

	mapping(bytes32 => Iexec0xLib.WorkOrder)                        m_workorders;
	mapping(bytes32 => mapping(address => Iexec0xLib.Contribution)) m_contributions;




	Marketplace_ABIEncoderV2 marketplace;

	modifier onlyMarketplace()
	{
		require(msg.sender == address(marketplace));
		_;
	}
	modifier onlyScheduler(bytes32 _woid)
	{
		require(msg.sender == marketplace.viewDeal(_woid).pool.owner);
		_;
	}






	function initiateConsensus(
		bytes32 _woid)
	public onlyMarketplace
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == Iexec0xLib.WorkOrderStatusEnum.UNSET);

		workorder.status            = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.consensusDeadline = now + 0; // TODO
	}

	function allowWorkerToContribute(
		bytes32 _woid,
		address _worker,
		address _enclaveChallenge)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );
		// check _worker is in workerpool

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][_worker];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.UNSET);

		contribution.status           = Iexec0xLib.ContributionStatusEnum.AUTHORIZED;
		contribution.enclaveChallenge = _enclaveChallenge;

		// emit AllowWorkerToContribute(_woid, _worker);
	}

	function contribute(
		bytes32              _woid,
		bytes32              _resultHash,
		bytes32              _resultSign,
		Iexec0xLib.signature _challengeSign)
	public
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.AUTHORIZED);

		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
			require(contribution.enclaveChallenge == ecrecover(keccak256(
				"\x19Ethereum Signed Message:\n64",
				_resultHash,
				_resultSign),
				_challengeSign.v,
				_challengeSign.r,
				_challengeSign.s)
			);
		}

		contribution.status     = Iexec0xLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		//contribution.score      = iexecHubInterface.getWorkerScore(msg.sender);
		workorder.contributors.push(msg.sender);

		//require(iexecHubInterface.lockForWork(_woid, msg.sender, consensus.stakeAmount));

		//emit Contribute(_woid, msg.sender, _resultHash);
	}

	function revealConsensus(
		bytes32 _woid,
		bytes32 _consensus)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );


		uint256 winnerCounter = 0;
		for (uint256 i = 0; i<workorder.contributors.length; ++i)
		{
			address w = workorder.contributors[i];
			if (
				m_contributions[_woid][w].resultHash == _consensus
				&&
				m_contributions[_woid][w].status == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
			)
			{
				winnerCounter = winnerCounter.add(1);
			}
		}
		require(winnerCounter > 0); // you cannot revealConsensus if no worker has contributed to this hash

		workorder.status         = Iexec0xLib.WorkOrderStatusEnum.REVEALING;
		workorder.consensusValue = _consensus;
		workorder.revealDeadline = now + 0; //TODO
		workorder.revealCounter  = 0;
		workorder.winnerCounter  = winnerCounter;

		//emit RevealConsensus(_woid, _consensus);
	}

	function reveal(
		bytes32 _woid,
		bytes32 _result)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    >  now                                     );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status         == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash     == workorder.consensusValue                     );
		require(contribution.resultHash     == keccak256(_result                        )   );
		require(contribution.resultSign     == keccak256(_result ^ keccak256(msg.sender))   );

		contribution.status     = Iexec0xLib.ContributionStatusEnum.PROVED;
		workorder.revealCounter = workorder.revealCounter.add(1);

		//emit Reveal(_woid, msg.sender, _result);
	}


	function finalizeWork(
		bytes32 _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealCounter     == workorder.winnerCounter
		    || (workorder.revealCounter     >  0  && workorder.revealDeadline <= now)  );

		workorder.status = Iexec0xLib.WorkOrderStatusEnum.COMPLETED;

		// TODO rewards

		//emit FinalizeWork(_woid,_stdout,_stderr,_uri);
	}





	// function reopen
	// function claimfailed



}
