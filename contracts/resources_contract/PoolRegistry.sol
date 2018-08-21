pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Pool.sol";
import "./RegistryBase.sol";

contract PoolRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreatePool(address indexed poolOwner, address indexed pool, string poolDescription);

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
	function createPool(
		address _poolOwner,
		string  _poolDescription,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	public /* onlyOwner /*owner == IexecHub*/ returns (Pool)
	{
		Pool newPool = new Pool(
			_poolOwner,
			_poolDescription,
			_subscriptionLockStakePolicy,
			_subscriptionMinimumStakePolicy,
			_subscriptionMinimumScorePolicy
		);
		require(insert(newPool, _poolOwner));
		emit CreatePool(_poolOwner, newPool, _poolDescription);
		return newPool;
	}
}
