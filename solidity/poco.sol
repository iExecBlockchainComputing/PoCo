pragma solidity ^0.4.19;

/*****************************************************************************
 * Contract owned: restrict execution to creator                             *
 *****************************************************************************/
contract owned
{
	address owner;
	function owned() public
	{
		owner = msg.sender;
	}
	modifier onlyOwner
	{
		require(msg.sender == owner);
		_;
	}
}

/*****************************************************************************
 * Contract Consensus: ...                                                   *
 *****************************************************************************/
contract Consensus is owned
{
	enum Status { Pending, Done }
	struct Contribution
	{
		bool    valid;
		uint256 resultHash;
		uint256 resultSign;
	}
	Status                           public m_status;
	uint256                          public m_resultHash;
	uint                             public m_grant;
	uint                             public m_stake;
	address                          public m_chair;
	address[]                        public m_contributors;
	mapping(address => Contribution) public m_contributions;

	uint                             public m_reward;
	uint                             public m_individualReward;

	function Consensus(uint _grant, uint _stake, address _chair) public
	{
		m_status = Status.Pending;
		m_grant  = _grant;
		m_stake  = _stake;
		m_reward = _grant;
		m_chair  = _chair;
	}

	function submit(address _worker, uint256 _resultHash, uint256 _resultSign) public onlyOwner
	{
		require(m_status == Status.Pending);

		m_contributors.push(msg.sender);
		m_contributions[msg.sender] = Contribution({
			valid:      true,
			resultHash: _resultHash,
			resultSign: _resultSign
		});
	}

	function finalize(uint256 _resultHash) public onlyOwner
	{
		require(m_status == Status.Pending);

		uint winners = 0;
		m_status     = Status.Done;
		m_resultHash = _resultHash;
		for (uint i=0; i<m_contributors.length; ++i)
		{
		    address w = m_contributors[i];
			if (m_contributions[w].resultHash == _resultHash)
			{
				++winners;
			}
			else
			{
				m_reward += m_stake;
			}
		}
		m_individualReward = m_reward / winners;
	}

	function close() public onlyOwner
	{
		selfdestruct(owner);
	}
}

/*****************************************************************************
 * Contract Stacker: ...                                                     *
 *****************************************************************************/
contract Staker
{
	/**
	 * Account structure
	 */
	struct Account
	{
		uint stake;
		uint locked;
	}
	/**
	 * Internal data: address to account mapping
	 */
	mapping(address => Account) m_accounts;
	/**
	 * Public functions
	 */
	function balance() public view returns(uint)
	{
		return m_accounts[msg.sender].stake;
	}
	function deposit() public payable
	{
		m_accounts[msg.sender].stake += msg.value;
	}
	function withdraw(uint _amount) public
	{
		require(_amount > 0  && m_accounts[msg.sender].stake >= _amount);
		m_accounts[msg.sender].stake -= _amount;
		msg.sender.transfer(_amount);
	}
	/**
	 * Internal function
	 */
	function lock(address _worker, uint _amount) internal
	{
		require(m_accounts[_worker].stake >= _amount);
		m_accounts[_worker].stake  -= _amount;
		m_accounts[_worker].locked += _amount;
	}
	function unlock(address _worker, uint _amount) internal
	{
		require(m_accounts[_worker].locked >= _amount);
		m_accounts[_worker].locked -= _amount;
		m_accounts[_worker].stake  += _amount;
	}
	function reward(address _worker, uint _amount) internal
	{
		m_accounts[msg.sender].stake += _amount;
	}
	function seize(address _worker, uint _amount) internal
	{
		require(m_accounts[_worker].locked >= _amount);
		m_accounts[_worker].locked -= _amount;
	}
}

/*****************************************************************************
 * Contract PoCo: ...                                                        *
 *****************************************************************************/
contract PoCo is Staker
{
	mapping(uint => Consensus) m_tasks;
	mapping(address => uint)   m_reputation;

	// DEBUG
	function show(uint256 _taskID) public view returns(Consensus)
	{
		return m_tasks[_taskID];
	}

	function createTask(uint256 _taskID, uint _grant, uint _stake) public
	{
		require(m_tasks[_taskID] == address(0));

		m_tasks[_taskID] = new Consensus({
			_grant: _grant,
			_stake: _stake,
			_chair: msg.sender
		});
	}

	function submit(uint256 _taskID, uint256 _resultHash, uint256 _resultSign) public
	{
		require(m_tasks[_taskID] != address(0));
		/* require(m_tasks[_taskID].m_status() == Consensus.Status.Pending) */
		require(m_tasks[_taskID].m_stake()  <= m_accounts[msg.sender].stake);

		m_tasks[_taskID].submit({
			_worker:     msg.sender,
			_resultHash: _resultHash,
			_resultSign: _resultSign
		});

		//freeze(msg.sender, tasks[_taskID].stake);
	}

	function finalizeTask(uint256 _taskID, uint256 _resultHash) public
	{
		require(m_tasks[_taskID] != address(0));
		/* require(tasks[_taskID].m_status == Consensus.Status.Pending); */
		require(m_tasks[_taskID].m_chair() == msg.sender);

		m_tasks[_taskID].finalize({
			_resultHash: _resultHash
		});

		address[] memory contributors = m_tasks[_taskID].m_contributors();
		for (uint i=0; i<contributors.length; ++i)
		{
			address w = contributors[i];
			if (m_tasks[_taskID].m_contributions()[w].resultHash == _resultHash)
			{
				/* unfreeze(w, m_tasks[_key].m_stake()); */
				/* reward  (w, m_tasks[_key].m_individualReward()); */
				m_reputation[w] = SafeMath.safeAdd(m_reputation[w], 1);
			}
			else
			{
				/* seize(w, m_tasks[_key].m_stake()); */
				m_reputation[w] = SafeMath.safeSub(m_reputation[w], SafeMath.min(m_reputation[w], 50));
			}
		}
	}
}
