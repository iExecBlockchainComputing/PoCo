pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "./tools/IexecODBLibCore.sol";
import "./tools/IexecODBLibOrders.sol";
import "./tools/SafeMathOZ.sol";

import "./Escrow.sol";
import "./IexecHubAccessor.sol";

import "./registries/Dapp.sol";
import "./registries/Data.sol";
import "./registries/Pool.sol";

import "./permissions/GroupInterface.sol";

contract IexecClerkABILegacy
{
	uint256 public constant POOL_STAKE_RATIO = 30;
	uint256 public constant KITTY_RATIO      = 10;
	uint256 public constant KITTY_MIN        = 1000000000; // TODO: 1RLC ?

	bytes32 public /* immutable */ EIP712DOMAIN_SEPARATOR;

	mapping(bytes32 => bytes32[]             ) public m_userdeals;
	mapping(bytes32 => uint256               ) public m_consumed;
	mapping(bytes32 => bool                  ) public m_presigned;

	event OrdersMatched  (bytes32 dealid,
	                      bytes32 dappHash,
	                      bytes32 dataHash,
	                      bytes32 poolHash,
	                      bytes32 userHash,
												uint256 volume);
	event ClosedDappOrder(bytes32 dappHash);
	event ClosedDataOrder(bytes32 dataHash);
	event ClosedPoolOrder(bytes32 poolHash);
	event ClosedUserOrder(bytes32 userHash);

	event SchedulerNotice(address indexed pool, bytes32 dealid);

	function viewUserDeals(bytes32 _id)
	public view returns (bytes32[]);

	function viewConsumed(bytes32 _id)
	public view returns (uint256);

	function checkRestriction(address _restriction, address _candidate, bytes1 _mask)
	public view returns (bool);

	// function verify(
	// 	address                     _signer,
	// 	bytes32                     _hash,
	// 	IexecODBLibOrders.signature _signature)
	// public view returns (bool);

	// function signDappOrder(IexecODBLibOrders.DappOrder _dapporder)
	// public returns (bool);

	// function signDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	// public returns (bool);

	// function signPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	// public returns (bool);

	// function signUserOrder(IexecODBLibOrders.UserOrder _userorder)
	// public returns (bool);

	// function matchOrders(
	// 	IexecODBLibOrders.DappOrder _dapporder,
	// 	IexecODBLibOrders.DataOrder _dataorder,
	// 	IexecODBLibOrders.PoolOrder _poolorder,
	// 	IexecODBLibOrders.UserOrder _userorder)
	// public returns (bytes32);

	// function cancelDappOrder(IexecODBLibOrders.DappOrder _dapporder)
	// public returns (bool);

	// function cancelDataOrder(IexecODBLibOrders.DataOrder _dataorder)
	// public returns (bool);

	// function cancelPoolOrder(IexecODBLibOrders.PoolOrder _poolorder)
	// public returns (bool);

	// function cancelUserOrder(IexecODBLibOrders.UserOrder _userorder)
	// public returns (bool);

	function lockSubscription  (address _worker, uint256 _amount)
	public;

	function unlockSubscription(address _worker, uint256 _amount)
	public;

	function lockContribution(bytes32 _dealid, address _worker)
	public;

	function unlockContribution(bytes32 _dealid, address _worker)
	public;

	function unlockAndRewardForContribution(bytes32 _dealid, address _worker, uint256 _amount)
	public;

	function seizeContribution(bytes32 _dealid, address _worker)
	public;

	function rewardForScheduling(bytes32 _dealid, uint256 _amount)
	public;

	function successWork(bytes32 _dealid)
	public;

	function failedWork(bytes32 _dealid)
	public;




	function viewDealABILegacy_pt1(bytes32 _id)
	public view returns
	( address
	, address
	, uint256
	, address
	, address
	, uint256
	, address
	, address
	, uint256
	);
	function viewDealABILegacy_pt2(bytes32 _id)
	public view returns
	( uint256
	, uint256
	, address
	, address
	, address
	, string
	);

	function viewConfigABILegacy(bytes32 _id)
	public view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	);

	function viewAccountABILegacy(address _user)
	public view returns (uint256, uint256);
}
