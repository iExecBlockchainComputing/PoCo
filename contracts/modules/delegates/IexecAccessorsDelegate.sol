pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../DelegateBase.sol";
import "../interfaces/IexecAccessors.sol";


contract IexecAccessorsDelegate is IexecAccessors, DelegateBase
{

	function name()
	external override view returns (string memory)
	{
		return m_name;
	}

	function symbol()
	external override view returns (string memory)
	{
		return m_symbol;
	}

	function decimals()
	external override view returns (uint8)
	{
		return m_decimals;
	}

	function totalSupply()
	external override view returns (uint256)
	{
		return m_totalSupply;
	}

	function balanceOf(address account)
	external override view returns (uint256)
	{
		return m_balances[account];
	}

	function frozenOf(address account)
	external override view returns (uint256)
	{
		return m_frozens[account];
	}

	function allowance(address account, address spender)
	external override view returns (uint256)
	{
		return m_allowances[account][spender];
	}

	function viewAccount(address account)
	external override view returns (IexecLibCore_v4.Account memory)
	{
		return IexecLibCore_v4.Account(m_balances[account], m_frozens[account]);
	}

	function token()
	external override view returns (address)
	{
		return address(m_baseToken);
	}

	function viewDeal(bytes32 _id)
	external override view returns (IexecLibCore_v4.Deal memory deal)
	{
		return m_deals[_id];
	}

	function viewConsumed(bytes32 _id)
	external override view returns (uint256 consumed)
	{
		return m_consumed[_id];
	}

	function viewPresigned(bytes32 _id)
	external override view returns (address signer)
	{
		return m_presigned[_id];
	}

	function viewTask(bytes32 _taskid)
	external override view returns (IexecLibCore_v4.Task memory)
	{
		return m_tasks[_taskid];
	}

	function viewContribution(bytes32 _taskid, address _worker)
	external override view returns (IexecLibCore_v4.Contribution memory)
	{
		return m_contributions[_taskid][_worker];
	}

	function viewScore(address _worker)
	external override view returns (uint256)
	{
		return m_workerScores[_worker];
	}

	function resultFor(bytes32 id)
	external override view returns (bytes memory)
	{
		IexecLibCore_v4.Task storage task = m_tasks[id];
		require(task.status == IexecLibCore_v4.TaskStatusEnum.COMPLETED);
		return task.results;
	}

	function viewCategory(uint256 _catid)
	external override view returns (IexecLibCore_v4.Category memory category)
	{
		return m_categories[_catid];
	}

	function countCategory()
	external override view returns (uint256 count)
	{
		return m_categories.length;
	}


	function appregistry()
	external override view returns (IRegistry)
	{
		return m_appregistry;
	}

	function datasetregistry()
	external override view returns (IRegistry)
	{
		return m_datasetregistry;
	}

	function workerpoolregistry()
	external override view returns (IRegistry)
	{
		return m_workerpoolregistry;
	}

}
