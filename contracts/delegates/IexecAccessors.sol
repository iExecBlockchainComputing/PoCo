pragma solidity ^0.5.9;
pragma experimental ABIEncoderV2;

import "../IexecStore.sol";


interface IexecAccessors
{
	function name() external view returns (string memory);
	function symbol() external view returns (string memory);
	function decimals() external view returns (uint8);
	function totalSupply() external view returns (uint256);
	function balanceOf(address) external view returns (uint256);
	function frozenOf(address) external view returns (uint256);
	function allowance(address,address) external view returns (uint256);
	function viewAccount(address) external view returns (IexecODBLibCore.Account memory);
	function token() external view returns (address);
	function viewDeal(bytes32) external view returns (IexecODBLibCore.Deal memory);
	function viewRequestDeals(bytes32) external view returns (bytes32[] memory);
	function viewConsumed(bytes32) external view returns (uint256);
	function viewPresigned(bytes32) external view returns (bool);
	function viewTask(bytes32) external view returns (IexecODBLibCore.Task memory);
	function viewContribution(bytes32,address) external view returns (IexecODBLibCore.Contribution memory);
	function viewScore(address) external view returns (uint256);
	function resultFor(bytes32) external view returns (bytes memory);
	function viewCategory(uint256) external view returns (IexecODBLibCore.Category memory);
	function countCategory() external view returns (uint256);
}

contract IexecAccessorsDelegate is IexecAccessors, IexecStore
{

	function name()
	external view returns (string memory)
	{
		return m_name;
	}

	function symbol()
	external view returns (string memory)
	{
		return m_symbol;
	}

	function decimals()
	external view returns (uint8)
	{
		return m_decimals;
	}

	function totalSupply()
	external view returns (uint256)
	{
		return m_totalSupply;
	}

	function balanceOf(address account)
	external view returns (uint256)
	{
		return m_balances[account];
	}

	function frozenOf(address account)
	external view returns (uint256)
	{
		return m_frozens[account];
	}

	function allowance(address account, address spender)
	external view returns (uint256)
	{
		return m_allowances[account][spender];
	}

	function viewAccount(address account)
	external view returns (IexecODBLibCore.Account memory)
	{
		return IexecODBLibCore.Account(m_balances[account], m_frozens[account]);
	}

	function token()
	external view returns (address)
	{
		return address(m_baseToken);
	}

	function viewDeal(bytes32 _id)
	external view returns (IexecODBLibCore.Deal memory deal)
	{
		return m_deals[_id];
	}

	function viewRequestDeals(bytes32 _id)
	external view returns (bytes32[] memory)
	{
		return m_requestdeals[_id];
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

	function viewTask(bytes32 _taskid)
	external view returns (IexecODBLibCore.Task memory)
	{
		return m_tasks[_taskid];
	}

	function viewContribution(bytes32 _taskid, address _worker)
	external view returns (IexecODBLibCore.Contribution memory)
	{
		return m_contributions[_taskid][_worker];
	}

	function viewScore(address _worker)
	external view returns (uint256)
	{
		return m_workerScores[_worker];
	}

	function resultFor(bytes32 id)
	external view returns (bytes memory)
	{
		IexecODBLibCore.Task storage task = m_tasks[id];
		require(task.status == IexecODBLibCore.TaskStatusEnum.COMPLETED);
		return task.results;
	}

	function viewCategory(uint256 _catid)
	external view returns (IexecODBLibCore.Category memory category)
	{
		return m_categories[_catid];
	}

	function countCategory()
	external view returns (uint256 count)
	{
		return m_categories.length;
	}





	function viewDealABILegacy_pt1(bytes32 _id)
	external view returns
	( address
	, address
	, uint256
	, address
	, address
	, uint256
	, address
	, address
	, uint256
	)
	{
		IexecODBLibCore.Deal memory deal = m_deals[_id];
		return (
			deal.app.pointer,
			deal.app.owner,
			deal.app.price,
			deal.dataset.pointer,
			deal.dataset.owner,
			deal.dataset.price,
			deal.workerpool.pointer,
			deal.workerpool.owner,
			deal.workerpool.price
		);
	}

	function viewDealABILegacy_pt2(bytes32 _id)
	external view returns
	( uint256
	, bytes32
	, address
	, address
	, address
	, string memory
	)
	{
		IexecODBLibCore.Deal memory deal = m_deals[_id];
		return (
			deal.trust,
			deal.tag,
			deal.requester,
			deal.beneficiary,
			deal.callback,
			deal.params
		);
	}

	function viewConfigABILegacy(bytes32 _id)
	external view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	)
	{
		IexecODBLibCore.Deal memory deal = m_deals[_id];
		return (
			deal.category,
			deal.startTime,
			deal.botFirst,
			deal.botSize,
			deal.workerStake,
			deal.schedulerRewardRatio
		);
	}

	function viewAccountABILegacy(address account)
	external view returns (uint256, uint256)
	{
		return ( m_balances[account], m_frozens[account] );
	}

	function viewTaskABILegacy(bytes32 _taskid)
	external view returns
	( IexecODBLibCore.TaskStatusEnum
	, bytes32
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, bytes32
	, uint256
	, uint256
	, address[] memory
	, bytes     memory
	)
	{
		IexecODBLibCore.Task memory task = m_tasks[_taskid];
		return (
			task.status,
			task.dealid,
			task.idx,
			task.timeref,
			task.contributionDeadline,
			task.revealDeadline,
			task.finalDeadline,
			task.consensusValue,
			task.revealCounter,
			task.winnerCounter,
			task.contributors,
			task.results
		);
	}

	function viewContributionABILegacy(bytes32 _taskid, address _worker)
	external view returns
	( IexecODBLibCore.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	)
	{
		IexecODBLibCore.Contribution memory contribution = m_contributions[_taskid][_worker];
		return (
			contribution.status,
			contribution.resultHash,
			contribution.resultSeal,
			contribution.enclaveChallenge
		);
	}

	function viewCategoryABILegacy(uint256 _catid)
	external view returns (string memory, string memory, uint256)
	{
		IexecODBLibCore.Category memory category = m_categories[_catid];
		return ( category.name, category.description, category.workClockTimeRef );
	}
}
