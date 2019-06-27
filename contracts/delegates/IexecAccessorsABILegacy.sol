pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./DelegateBase.sol";


interface IexecAccessorsABILegacy
{
	function viewAccountABILegacy(address _user)
	external view returns (uint256, uint256);

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
	);

	function viewDealABILegacy_pt2(bytes32 _id)
	external view returns
	( uint256
	, bytes32
	, address
	, address
	, address
	, string memory
	);

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
	);

	function viewContributionABILegacy(bytes32 _taskid, address _worker)
	external view returns
	( IexecODBLibCore.ContributionStatusEnum
	, bytes32
	, bytes32
	, address
	);

	function viewCategoryABILegacy(uint256 _catid)
	external view returns (string memory, string memory, uint256);

	function viewConfigABILegacy(bytes32 _id)
	external view returns
	( uint256
	, uint256
	, uint256
	, uint256
	, uint256
	, uint256
	);
}

contract IexecAccessorsABILegacyDelegate is IexecAccessorsABILegacy, DelegateBase
{
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
