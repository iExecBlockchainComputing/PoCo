pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./interfaces/ERC725.sol";
import "./libs/IexecODBLibCore.sol";
import "./libs/IexecODBLibOrders.sol";
import "./libs/SafeMathOZ.sol";
import "./registries/App.sol";
import "./registries/Dataset.sol";
import "./registries/Workerpool.sol";
// import "./permissions/GroupInterface.sol";

import "./Escrow.sol";
import "./IexecHubAccessor.sol";

contract IexecClerk is Escrow, IexecHubAccessor
{
	using SafeMathOZ for uint256;
	using IexecODBLibOrders for *;

	/***************************************************************************
	 *                                Constants                                *
	 ***************************************************************************/
	uint256 public constant WORKERPOOL_STAKE_RATIO = 30;
	uint256 public constant KITTY_RATIO            = 10;
	uint256 public constant KITTY_MIN              = 1000000000; // TODO: 1RLC ?

	/***************************************************************************
	 *                            EIP712 signature                             *
	 ***************************************************************************/
	bytes32 public /* immutable */ EIP712DOMAIN_SEPARATOR;

	/***************************************************************************
	 *                               Clerk data                                *
	 ***************************************************************************/
	mapping(bytes32 => bytes32[]           ) m_requestdeals;
	mapping(bytes32 => IexecODBLibCore.Deal) m_deals;
	mapping(bytes32 => uint256             ) m_consumed;
	mapping(bytes32 => bool                ) m_presigned;

	/***************************************************************************
	 *                                 Events                                  *
	 ***************************************************************************/
	event OrdersMatched        (bytes32 dealid, bytes32 appHash, bytes32 datasetHash, bytes32 workerpoolHash, bytes32 requestHash, uint256 volume);
	event ClosedAppOrder       (bytes32 appHash);
	event ClosedDatasetOrder   (bytes32 datasetHash);
	event ClosedWorkerpoolOrder(bytes32 workerpoolHash);
	event ClosedRequestOrder   (bytes32 requestHash);
	event SchedulerNotice      (address indexed workerpool, bytes32 dealid);

	/***************************************************************************
	 *                               Constructor                               *
	 ***************************************************************************/
	constructor(
		address _token,
		address _iexechub,
		uint256 _chainid)
	public
	Escrow(_token)
	IexecHubAccessor(_iexechub)
	{
		EIP712DOMAIN_SEPARATOR = IexecODBLibOrders.EIP712Domain({
			name:              "iExecODB"
		, version:           "3.0-alpha"
		, chainId:           _chainid
		, verifyingContract: address(this)
		}).hash();
	}

	/***************************************************************************
	 *                                Accessor                                 *
	 ***************************************************************************/
	function viewRequestDeals(bytes32 _id)
	external view returns (bytes32[] memory requestdeals)
	{
		return m_requestdeals[_id];
	}

	function viewDeal(bytes32 _id)
	external view returns (IexecODBLibCore.Deal memory deal)
	{
		return m_deals[_id];
	}

	function viewConsumed(bytes32 _id)
	external view returns (uint256 consumed)
	{
		return m_consumed[_id];
	}

	function viewPresigned(bytes32 _id)
	external view returns (bool presigned)
	{
		return m_presigned[_id];
	}

	/***************************************************************************
	 *                       Hashing and signature tools                       *
	 ***************************************************************************/
	// internal ?
	function checkRestriction(address _identity, address _candidate, uint256 _purpose)
	public view returns (bool)
	{
		return _identity == address(0)                                                  // No restriction
		    || _identity == _candidate                                                  // Simple address
		    || ERC725(_identity).keyHasPurpose(bytes32(uint256(_candidate)), _purpose); // Identity contract
	}

	// internal ?
	function verifySignature(
		address                            _identity,
		bytes32                            _hash,
		IexecODBLibOrders.signature memory _signature)
	public view returns (bool)
	{
		// Consider presign before. checkRestriction throws on error
		return m_presigned[_hash] || checkRestriction(
			_identity,
			ecrecover(
				keccak256(abi.encodePacked("\x19\x01", EIP712DOMAIN_SEPARATOR, _hash)),
				_signature.v,
				_signature.r,
				_signature.s
			),
			2 // order must be signed by ACTION_KEY
		);
	}

	/***************************************************************************
	 *                            pre-signing tools                            *
	 ***************************************************************************/
	// should be external
	function signAppOrder(IexecODBLibOrders.AppOrder memory _apporder)
	public returns (bool)
	{
		require(msg.sender == App(_apporder.app).m_owner());
		m_presigned[_apporder.hash()] = true;
		return true;
	}

	// should be external
	function signDatasetOrder(IexecODBLibOrders.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		require(msg.sender == Dataset(_datasetorder.dataset).m_owner());
		m_presigned[_datasetorder.hash()] = true;
		return true;
	}

	// should be external
	function signWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).m_owner());
		m_presigned[_workerpoolorder.hash()] = true;
		return true;
	}

	// should be external
	function signRequestOrder(IexecODBLibOrders.RequestOrder memory _requestorder)
	public returns (bool)
	{
		require(msg.sender == _requestorder.requester);
		m_presigned[_requestorder.hash()] = true;
		return true;
	}

	/***************************************************************************
	 *                              Clerk methods                              *
	 ***************************************************************************/
	struct Identities
	{
		bytes32 appHash;
		address appOwner;
		bytes32 datasetHash;
		address datasetOwner;
		bytes32 workerpoolHash;
		address workerpoolOwner;
		bytes32 requestHash;
		bool    hasDataset;
	}

	// should be external
	function matchOrders(
		IexecODBLibOrders.AppOrder        memory _apporder,
		IexecODBLibOrders.DatasetOrder    memory _datasetorder,
		IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder,
		IexecODBLibOrders.RequestOrder    memory _requestorder)
	public returns (bytes32)
	{
		/**
		 * Check orders compatibility
		 */

		// computation environment & allowed enough funds
		require(_requestorder.category           == _workerpoolorder.category       );
		require(_requestorder.trust              <= _workerpoolorder.trust          );
		require(_requestorder.appmaxprice        >= _apporder.appprice              );
		require(_requestorder.datasetmaxprice    >= _datasetorder.datasetprice      );
		require(_requestorder.workerpoolmaxprice >= _workerpoolorder.workerpoolprice);
		require((_apporder.tag | _datasetorder.tag | _requestorder.tag) & ~_workerpoolorder.tag == 0x0);

		// Check matching and restrictions
		require(_requestorder.app     == _apporder.app        );
		require(_requestorder.dataset == _datasetorder.dataset);
		require(checkRestriction(_requestorder.workerpool,           _workerpoolorder.workerpool, 4)); // requestorder.workerpool is a restriction
		require(checkRestriction(_apporder.datasetrestrict,          _datasetorder.dataset,       4));
		require(checkRestriction(_apporder.workerpoolrestrict,       _workerpoolorder.workerpool, 4));
		require(checkRestriction(_apporder.requesterrestrict,        _requestorder.requester,     4));
		require(checkRestriction(_datasetorder.apprestrict,          _apporder.app,               4));
		require(checkRestriction(_datasetorder.workerpoolrestrict,   _workerpoolorder.workerpool, 4));
		require(checkRestriction(_datasetorder.requesterrestrict,    _requestorder.requester,     4));
		require(checkRestriction(_workerpoolorder.apprestrict,       _apporder.app,               4));
		require(checkRestriction(_workerpoolorder.datasetrestrict,   _datasetorder.dataset,       4));
		require(checkRestriction(_workerpoolorder.requesterrestrict, _requestorder.requester,     4));

		require(iexechub.checkResources(_apporder.app, _datasetorder.dataset, _workerpoolorder.workerpool));

		/**
		 * Check orders authenticity
		 */
		Identities memory ids;
		ids.hasDataset = _datasetorder.dataset != address(0);

		// app
		ids.appHash  = _apporder.hash();
		ids.appOwner = App(_apporder.app).m_owner();
		require(verifySignature(ids.appOwner, ids.appHash, _apporder.sign));

		// dataset
		if (ids.hasDataset) // only check if dataset is enabled
		{
			ids.datasetHash  = _datasetorder.hash();
			ids.datasetOwner = Dataset(_datasetorder.dataset).m_owner();
			require(verifySignature(ids.datasetOwner, ids.datasetHash, _datasetorder.sign));
		}

		// workerpool
		ids.workerpoolHash  = _workerpoolorder.hash();
		ids.workerpoolOwner = Workerpool(_workerpoolorder.workerpool).m_owner();
		require(verifySignature(ids.workerpoolOwner, ids.workerpoolHash, _workerpoolorder.sign));

		// request
		ids.requestHash = _requestorder.hash();
		require(verifySignature(_requestorder.requester, ids.requestHash, _requestorder.sign));

		/**
		 * Check availability
		 */
		uint256 volume;
		volume =                             _apporder.volume.sub       (m_consumed[ids.appHash       ]);
		volume = ids.hasDataset ? volume.min(_datasetorder.volume.sub   (m_consumed[ids.datasetHash   ])) : volume;
		volume =                  volume.min(_workerpoolorder.volume.sub(m_consumed[ids.workerpoolHash]));
		volume =                  volume.min(_requestorder.volume.sub   (m_consumed[ids.requestHash   ]));
		require(volume > 0);

		/**
		 * Record
		 */
		bytes32 dealid = keccak256(abi.encodePacked(
			ids.requestHash,            // requestHash
			m_consumed[ids.requestHash] // idx of first subtask
		));

		IexecODBLibCore.Deal storage deal = m_deals[dealid];
		deal.app.pointer          = _apporder.app;
		deal.app.owner            = ids.appOwner;
		deal.app.price            = _apporder.appprice;
		deal.dataset.owner        = ids.datasetOwner;
		deal.dataset.pointer      = _datasetorder.dataset;
		deal.dataset.price        = ids.hasDataset ? _datasetorder.datasetprice : 0;
		deal.workerpool.pointer   = _workerpoolorder.workerpool;
		deal.workerpool.owner     = ids.workerpoolOwner;
		deal.workerpool.price     = _workerpoolorder.workerpoolprice;
		deal.trust                = _requestorder.trust.max(1);
		deal.category             = _requestorder.category;
		deal.tag                  = _apporder.tag | _datasetorder.tag | _requestorder.tag;
		deal.requester            = _requestorder.requester;
		deal.beneficiary          = _requestorder.beneficiary;
		deal.callback             = _requestorder.callback;
		deal.params               = _requestorder.params;
		deal.startTime            = now;
		deal.botFirst             = m_consumed[ids.requestHash];
		deal.botSize              = volume;
		deal.workerStake          = _workerpoolorder.workerpoolprice.percentage(Workerpool(_workerpoolorder.workerpool).m_workerStakeRatioPolicy());
		deal.schedulerRewardRatio = Workerpool(_workerpoolorder.workerpool).m_schedulerRewardRatioPolicy();

		m_requestdeals[ids.requestHash].push(dealid);

		/**
		 * Update consumed
		 */
		m_consumed[ids.appHash       ] = m_consumed[ids.appHash       ].add(                 volume    );
		m_consumed[ids.datasetHash   ] = m_consumed[ids.datasetHash   ].add(ids.hasDataset ? volume : 0);
		m_consumed[ids.workerpoolHash] = m_consumed[ids.workerpoolHash].add(                 volume    );
		m_consumed[ids.requestHash   ] = m_consumed[ids.requestHash   ].add(                 volume    );

		/**
		 * Lock
		 */
		lock(
			deal.requester,
			deal.app.price
			.add(deal.dataset.price)
			.add(deal.workerpool.price)
			.mul(volume)
		);
		lock(
			deal.workerpool.owner,
			deal.workerpool.price
			.percentage(WORKERPOOL_STAKE_RATIO) // ORDER IS IMPORTANT HERE!
			.mul(volume)                        // ORDER IS IMPORTANT HERE!
		);

		/**
		 * Advertize deal
		 */
		emit SchedulerNotice(deal.workerpool.pointer, dealid);

		/**
		 * Advertize consumption
		 */
		emit OrdersMatched(
			dealid,
			ids.appHash,
			ids.datasetHash,
			ids.workerpoolHash,
			ids.requestHash,
			volume
		);

		return dealid;
	}

	// should be external
	function cancelAppOrder(IexecODBLibOrders.AppOrder memory _apporder)
	public returns (bool)
	{
		bytes32 dapporderHash = _apporder.hash();
		require(msg.sender == App(_apporder.app).m_owner());
		// require(verify(msg.sender, dapporderHash, _apporder.sign));
		m_consumed[dapporderHash] = _apporder.volume;
		emit ClosedAppOrder(dapporderHash);
		return true;
	}

	// should be external
	function cancelDatasetOrder(IexecODBLibOrders.DatasetOrder memory _datasetorder)
	public returns (bool)
	{
		bytes32 dataorderHash = _datasetorder.hash();
		require(msg.sender == Dataset(_datasetorder.dataset).m_owner());
		// require(verify(msg.sender, dataorderHash, _datasetorder.sign));
		m_consumed[dataorderHash] = _datasetorder.volume;
		emit ClosedDatasetOrder(dataorderHash);
		return true;
	}

	// should be external
	function cancelWorkerpoolOrder(IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public returns (bool)
	{
		bytes32 poolorderHash = _workerpoolorder.hash();
		require(msg.sender == Workerpool(_workerpoolorder.workerpool).m_owner());
		// require(verify(msg.sender, poolorderHash, _workerpoolorder.sign));
		m_consumed[poolorderHash] = _workerpoolorder.volume;
		emit ClosedWorkerpoolOrder(poolorderHash);
		return true;
	}

	// should be external
	function cancelRequestOrder(IexecODBLibOrders.RequestOrder memory _requestorder)
	public returns (bool)
	{
		bytes32 requestorderHash = _requestorder.hash();
		require(msg.sender == _requestorder.requester);
		// require(verify(msg.sender, requestorderHash, _requestorder.sign));
		m_consumed[requestorderHash] = _requestorder.volume;
		emit ClosedRequestOrder(requestorderHash);
		return true;
	}

	/***************************************************************************
	 *                    Escrow overhead for contribution                     *
	 ***************************************************************************/
	function lockContribution(bytes32 _dealid, address _worker)
	external onlyIexecHub
	{
		lock(_worker, m_deals[_dealid].workerStake);
	}

	function unlockContribution(bytes32 _dealid, address _worker)
	external onlyIexecHub
	{
		unlock(_worker, m_deals[_dealid].workerStake);
	}

	function unlockAndRewardForContribution(bytes32 _dealid, address _worker, uint256 _amount)
	external onlyIexecHub
	{
		unlock(_worker, m_deals[_dealid].workerStake);
		reward(_worker, _amount);
	}

	function seizeContribution(bytes32 _dealid, address _worker)
	external onlyIexecHub
	{
		seize(_worker, m_deals[_dealid].workerStake);
	}

	function rewardForScheduling(bytes32 _dealid, uint256 _amount)
	external onlyIexecHub
	{
		reward(m_deals[_dealid].workerpool.owner, _amount);
	}

	function successWork(bytes32 _dealid)
	external onlyIexecHub
	{
		IexecODBLibCore.Deal storage deal = m_deals[_dealid];

		uint256 requesterstake = deal.app.price
		                         .add(deal.dataset.price)
		                         .add(deal.workerpool.price);
		uint256 poolstake = deal.workerpool.price
		                    .percentage(WORKERPOOL_STAKE_RATIO);

		// seize requester funds
		seize (deal.requester, requesterstake);
		// unlock pool stake
		unlock(deal.workerpool.owner, poolstake);
		// dapp reward
		reward(deal.app.owner, deal.app.price);
		// data reward
		if (deal.dataset.pointer != address(0))
		{
			reward(deal.dataset.owner, deal.dataset.price);
		}
		// pool reward performed by consensus manager

		/**
		 * Retrieve part of the kitty
		 * TODO: remove / keep ?
		 */
		uint256 kitty = m_accounts[address(0)].locked;
		if (kitty > 0)
		{
			kitty = kitty
			        .percentage(KITTY_RATIO) // fraction
			        .max(KITTY_MIN)          // at least this
			        .min(kitty);             // but not more than available
			seize (address(0),            kitty);
			reward(deal.workerpool.owner, kitty);
		}
	}

	function failedWork(bytes32 _dealid)
	external onlyIexecHub
	{
		IexecODBLibCore.Deal storage deal = m_deals[_dealid];

		uint256 requesterstake = deal.app.price
		                         .add(deal.dataset.price)
		                         .add(deal.workerpool.price);
		uint256 poolstake = deal.workerpool.price
		                    .percentage(WORKERPOOL_STAKE_RATIO);

		unlock(deal.requester,        requesterstake);
		seize (deal.workerpool.owner, poolstake     );
		reward(address(0),            poolstake     ); // → Kitty / Burn
		lock  (address(0),            poolstake     ); // → Kitty / Burn
	}

}
