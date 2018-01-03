pragma solidity ^0.4.19;

/* import "wallet.sol"; // For ETH based wallet */
import "RLC_wallet.sol"; // For RLC based wallet


contract PoCo is wallet
{
	enum Status { Null, Pending, Locked, Finished, Canceled }
	struct Task
	{
		Status  status;
		address chair;
		uint    reward;
		uint    stake;
	}
	struct Contribution
	{
		bool submitted;
		uint resultHash;
		uint resultSign;
		int  balance;
	}

	mapping(uint => Task                            ) public m_tasks;
	mapping(uint => address[]                       ) public m_tasksWorkers;
	mapping(uint => mapping(address => Contribution)) public m_tasksContributions;
	mapping(address => uint                         ) public m_reputation;

	/* function PoCo(address _tokenAddress) public // For ETH based wallet */
	function PoCo(address _tokenAddress) wallet(_tokenAddress) public // For RLC based wallet
	{
	}

	function reputation(address _user) public view returns (uint)
	{
		return m_reputation[_user];
	}

	function createTask(uint _taskID, uint _reward, uint _stake) public returns (bool)
	{
		require(m_tasks[_taskID].status == Status.Null);
		m_tasks[_taskID].status = Status.Pending;
		m_tasks[_taskID].reward = _reward;
		m_tasks[_taskID].stake  = _stake;
		m_tasks[_taskID].chair  = msg.sender;

		return true;
	}

	function submit(uint _taskID, uint _resultHash, uint _resultSign) public returns (bool)
	{
		require(m_tasks[_taskID].status == Status.Pending);
		require(!m_tasksContributions[_taskID][msg.sender].submitted);

		lock(msg.sender, m_tasks[_taskID].stake);

		m_tasksWorkers[_taskID].push(msg.sender);
		m_tasksContributions[_taskID][msg.sender].submitted  = true;
		m_tasksContributions[_taskID][msg.sender].resultHash = _resultHash;
		m_tasksContributions[_taskID][msg.sender].resultSign = _resultSign;

		return true;
	}

	function finalizeTask(uint _taskID, uint _consensus) public returns (bool)
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Locked);
		m_tasks[_taskID].status = Status.Finished;

		uint    i;
		address w;
		uint reward     = m_tasks[_taskID].reward;
		uint cntWinners = 0;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				++cntWinners; //TODO: SafeMath
			}
			else
			{
				reward += m_tasks[_taskID].stake; //TODO: SafeMath
			}
		}
		require(cntWinners > 0);
		uint individualReward = reward / cntWinners; //TODO: SafeMath
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				reward(w, individualReward);
				unlock(w, m_tasks[_taskID].stake);
				m_reputation[w] += 1; //TODO: SafeMath

				m_tasksContributions[_taskID][msg.sender].balance = individualReward;
			}
			else
			{
				// No Reward
				seize(w, m_tasks[_taskID].stake);
				m_reputation[w] -= min(50, m_reputation[w]); //TODO: SafeMath

				m_tasksContributions[_taskID][msg.sender].balance =  -m_tasks[_taskID].stake; //TODO: SafeMath
			}
		}

		return true;
	}

	function cancel(uint _taskID) public returns (bool)
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Pending || m_tasks[_taskID].status == Status.Locked);
		m_tasks[_taskID].status = Status.Canceled;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			unlock(w, m_tasks[_taskID].stake);
		}

		return true;
	}

	function lock(uint _taskID) public
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Pending);
		m_tasks[_taskID].status = Status.Locked;
	}

	function unlock(uint _taskID) public
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Locked);
		m_tasks[_taskID].status = Status.Pending;
	}
}
