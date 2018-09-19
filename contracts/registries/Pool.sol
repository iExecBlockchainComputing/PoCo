pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import '../tools/Ownable.sol';
import '../tools/SafeMathOZ.sol';

contract Pool is OwnableImmutable
{
	using SafeMathOZ for uint256;

	/**
	 * Parameters
	 */
	string  public m_poolDescription;
	uint256 public m_workerStakeRatioPolicy;         // % of reward to stake
	uint256 public m_schedulerRewardRatioPolicy;     // % of reward given to scheduler
	uint256 public m_subscriptionLockStakePolicy;    // Stake locked when in workerpool - Constant set by constructor, do not update
	uint256 public m_subscriptionMinimumStakePolicy; // Minimum stake for subscribing
	uint256 public m_subscriptionMinimumScorePolicy; // Minimum score for subscribing

	/**
	 * Events
	 */
	event PoolPolicyUpdate(
		uint256 oldWorkerStakeRatioPolicy,         uint256 newWorkerStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy,     uint256 newSchedulerRewardRatioPolicy,
		uint256 oldSubscriptionMinimumStakePolicy, uint256 newSubscriptionMinimumStakePolicy,
		uint256 oldSubscriptionMinimumScorePolicy, uint256 newSubscriptionMinimumScorePolicy);

	/**
	 * Constructor
	 */
	constructor(
		address _poolOwner,
		string  _poolDescription,
		uint256 _subscriptionLockStakePolicy,
		uint256 _subscriptionMinimumStakePolicy,
		uint256 _subscriptionMinimumScorePolicy)
	public
	OwnableImmutable(_poolOwner)
	{
		m_poolDescription                = _poolDescription;
		m_workerStakeRatioPolicy         = 30;                               // mutable
		m_schedulerRewardRatioPolicy     = 1;                                // mutable
		m_subscriptionLockStakePolicy    = _subscriptionLockStakePolicy;     // constant
		m_subscriptionMinimumStakePolicy = _subscriptionMinimumStakePolicy;  // mutable
		m_subscriptionMinimumScorePolicy = _subscriptionMinimumScorePolicy;  // mutable
	}

	function changePoolPolicy(
		uint256 _newWorkerStakeRatioPolicy,
		uint256 _newSchedulerRewardRatioPolicy,
		uint256 _newSubscriptionMinimumStakePolicy,
		uint256 _newSubscriptionMinimumScorePolicy)
	public onlyOwner
	{
		require(_newSchedulerRewardRatioPolicy <= 100);

		emit PoolPolicyUpdate(
			m_workerStakeRatioPolicy,         _newWorkerStakeRatioPolicy,
			m_schedulerRewardRatioPolicy,     _newSchedulerRewardRatioPolicy,
			m_subscriptionMinimumStakePolicy, _newSubscriptionMinimumStakePolicy,
			m_subscriptionMinimumScorePolicy, _newSubscriptionMinimumScorePolicy
		);

		m_workerStakeRatioPolicy         = _newWorkerStakeRatioPolicy;
		m_schedulerRewardRatioPolicy     = _newSchedulerRewardRatioPolicy;
		m_subscriptionMinimumStakePolicy = _newSubscriptionMinimumStakePolicy;
		m_subscriptionMinimumScorePolicy = _newSubscriptionMinimumScorePolicy;
	}

}
