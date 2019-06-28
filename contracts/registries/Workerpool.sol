pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../tools/Once.sol";

contract Workerpool is Ownable, Once
{
	/**
	 * Parameters
	 */
	string  public m_workerpoolDescription;
	uint256 public m_workerStakeRatioPolicy;     // % of reward to stake
	uint256 public m_schedulerRewardRatioPolicy; // % of reward given to scheduler

	/**
	 * Events
	 */
	event PolicyUpdate(
		uint256 oldWorkerStakeRatioPolicy,     uint256 newWorkerStakeRatioPolicy,
		uint256 oldSchedulerRewardRatioPolicy, uint256 newSchedulerRewardRatioPolicy);

	/**
	 * Constructor
	 */
	function setup(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external onlyOnce()
	{
		_transferOwnership(_workerpoolOwner);
		m_workerpoolDescription      = _workerpoolDescription;
		m_workerStakeRatioPolicy     = 30; // mutable
		m_schedulerRewardRatioPolicy = 1;  // mutable
	}

	function changePolicy(
		uint256 _newWorkerStakeRatioPolicy,
		uint256 _newSchedulerRewardRatioPolicy)
	external onlyOwner
	{
		require(_newSchedulerRewardRatioPolicy <= 100);

		emit PolicyUpdate(
			m_workerStakeRatioPolicy,     _newWorkerStakeRatioPolicy,
			m_schedulerRewardRatioPolicy, _newSchedulerRewardRatioPolicy
		);

		m_workerStakeRatioPolicy     = _newWorkerStakeRatioPolicy;
		m_schedulerRewardRatioPolicy = _newSchedulerRewardRatioPolicy;
	}

	function transferOwnership(address) public { revert("disabled"); }

}
