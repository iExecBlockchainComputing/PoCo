pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import './Workerpool.sol';
import './RegistryBase.sol';

contract WorkerpoolRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateWorkerpool(address indexed workerpoolOwner, address indexed workerpool, string workerpoolDescription);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Pool creation
	 */
	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription,
		uint256          _subscriptionLockStakePolicy,
		uint256          _subscriptionMinimumStakePolicy,
		uint256          _subscriptionMinimumScorePolicy)
	external /* onlyOwner /*owner == IexecHub*/ returns (Workerpool)
	{
		Workerpool newWorkerpool = new Workerpool(
			_workerpoolOwner,
			_workerpoolDescription,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		require(insert(address(newWorkerpool), _workerpoolOwner));
		emit CreateWorkerpool(_workerpoolOwner, address(newWorkerpool), _workerpoolDescription);
		return newWorkerpool;
	}
}
