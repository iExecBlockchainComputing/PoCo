pragma solidity ^0.4.19;

/* import "./wallet.sol"; // For ETH based wallet */
import "./RLC_wallet.sol"; // For RLC based wallet


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

	/* function PoCo() public // For ETH based wallet */
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
		// TODO: where does the reward come from ?

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
		/**
		 * Reward distribution:
		 * totalReward is to be distributed amoung the winners relative to their
		 * contribution. I believe that the weight should be someting like:
		 *
		 * w ~= 1+log(max(1,reputation))
		 *
		 * But how to handle log in solidity ? Is it worth the gaz ?
		 * → https://ethereum.stackexchange.com/questions/8086/logarithm-math-operation-in-solidity#8110
		 *
		 * Current code shows a simple distribution (equal shares)
		 */
		uint    cntWinners       = 0;
 		uint    totalReward      = m_tasks[_taskID].reward;
 		uint    individualReward;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				++cntWinners; // TODO: SafeMath
			}
			else
			{
				totalReward += m_tasks[_taskID].stake; // TODO: SafeMath
			}
		}
		require(cntWinners > 0);
		individualReward = totalReward / cntWinners; // TODO: SafeMath
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				unlock(w, m_tasks[_taskID].stake);
				reward(w, individualReward);
				m_reputation[w] += 1; // TODO: SafeMath
				m_tasksContributions[_taskID][msg.sender].balance = int256(individualReward);
			}
			else
			{
				seize(w, m_tasks[_taskID].stake);
				// No Reward
				m_reputation[w] -= min256(50, m_reputation[w]); // TODO: SafeMath
				m_tasksContributions[_taskID][msg.sender].balance = -int256(m_tasks[_taskID].stake); // TODO: SafeMath
			}
		}

		/**
		 * Futur: requires a "log" function
		 */
		/*
		mapping(address => uint) workerWeight;
 		uint                     totalWeight       = 0;
		uint                     totalReward       = m_tasks[_taskID].reward;
		uint                     distributedReward = 0;
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				uint weight     = 1+log(max256(1, m_reputation[w]));
				workerWeight[w] = weight;
				totalWeight    += weight;
			}
			else
			{
				totalReward += m_tasks[_taskID].stake; // TODO: SafeMath
			}
		}
		require(totalWeight > 0);
		for (i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			w = m_tasksWorkers[_taskID][i];
			if (m_tasksContributions[_taskID][w].resultHash == _consensus)
			{
				unlock(w, m_tasks[_taskID].stake);
				uint individualReward = totalReward * workerWeight[w] / totalWeight;
				reward(w, individualReward);
				distributedReward += individualReward;
				m_reputation[w] += 1; // TODO: SafeMath
				m_tasksContributions[_taskID][msg.sender].balance = int256(individualReward);
			}
			else
			{
				seize(w, m_tasks[_taskID].stake);
				// No Reward
				m_reputation[w] -= min256(50, m_reputation[w]); // TODO: SafeMath
				m_tasksContributions[_taskID][msg.sender].balance = -int256(m_tasks[_taskID].stake); // TODO: SafeMath
			}
		}
		// TODO: What to do with the rest (totalReward - distributedReward) → To the scheduler ?
		*/

		return true;
	}

	function cancel(uint _taskID) public returns (bool)
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Pending || m_tasks[_taskID].status == Status.Locked);
		m_tasks[_taskID].status = Status.Canceled;
		for (uint i=0; i<m_tasksWorkers[_taskID].length; ++i)
		{
			unlock(m_tasksWorkers[_taskID][i], m_tasks[_taskID].stake);
		}
		// TODO: what happens to the original reward ?

		return true;
	}

	function lock(uint _taskID) public returns (bool)
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Pending);
		m_tasks[_taskID].status = Status.Locked;

		return true;
	}

	function unlock(uint _taskID) public returns (bool)
	{
		require(m_tasks[_taskID].chair  == msg.sender);
		require(m_tasks[_taskID].status == Status.Locked);
		m_tasks[_taskID].status = Status.Pending;

		return true;
	}
}
