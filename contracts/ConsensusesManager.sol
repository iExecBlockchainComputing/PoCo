pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "./Iexec0xLib.sol";
import "./Marketplace.sol";
import "./SafeMathOZ.sol";

contract ConsensusesManager
{
	using SafeMathOZ for uint256;

	/**
	 * Consensuses
	 */
	mapping(bytes32 => Iexec0xLib.WorkOrder)                        m_workorders;
	mapping(bytes32 => mapping(address => Iexec0xLib.Contribution)) m_contributions;

	/**
	 * Worker score
	 */
	mapping(address => uint256) public m_scores;




	/**
	 * Slaves contracts
	 */
	Marketplace marketplace;

	modifier onlyMarketplace()
	{
		require(msg.sender == address(marketplace));
		_;
	}
	modifier onlyScheduler(bytes32 _woid)
	{
		require(msg.sender == marketplace.viewDeal(_woid).pool.owner);
		_;
	}


	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}







	/**
	 * Consensus methods
	 */
	function initiateConsensus(
		bytes32 _woid)
	public onlyMarketplace
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == Iexec0xLib.WorkOrderStatusEnum.UNSET);

		workorder.status            = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.consensusDeadline = now + 0; // TODO

		//TODO event (with workerpoolID)
	}

	function allowWorkerToContribute(
		bytes32 _woid,
		address _worker,
		address _enclaveChallenge)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );
		// check _worker is in workerpool

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][_worker];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.UNSET);

		contribution.status           = Iexec0xLib.ContributionStatusEnum.AUTHORIZED;
		contribution.enclaveChallenge = _enclaveChallenge;

		// emit AllowWorkerToContribute(_woid, _worker);
	}

	function contribute(
		bytes32              _woid,
		bytes32              _resultHash,
		bytes32              _resultSign,
		Iexec0xLib.signature _challengeSign)
	public // worker
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status == Iexec0xLib.ContributionStatusEnum.AUTHORIZED);

		require(_resultHash != 0x0);
		require(_resultSign != 0x0);
		if (contribution.enclaveChallenge != address(0))
		{
			require(contribution.enclaveChallenge == ecrecover(keccak256(
				"\x19Ethereum Signed Message:\n64",
				_resultHash,
				_resultSign),
				_challengeSign.v,
				_challengeSign.r,
				_challengeSign.s)
			);
		}

		contribution.status     = Iexec0xLib.ContributionStatusEnum.CONTRIBUTED;
		contribution.resultHash = _resultHash;
		contribution.resultSign = _resultSign;
		contribution.score      = m_scores[msg.sender].mul(contribution.enclaveChallenge != address(0) ? 3 : 1);
		contribution.weight     = 1 + contribution.score.log();
		workorder.contributors.push(msg.sender);

		require(marketplace.lockContribution(_woid, msg.sender));

		//emit Contribute(_woid, msg.sender, _resultHash);
	}

	function revealConsensus(
		bytes32 _woid,
		bytes32 _consensus)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.ACTIVE);
		require(workorder.consensusDeadline >  now                                  );


		uint256 winnerCounter = 0;
		for (uint256 i = 0; i<workorder.contributors.length; ++i)
		{
			address w = workorder.contributors[i];
			if (
				m_contributions[_woid][w].resultHash == _consensus
				&&
				m_contributions[_woid][w].status == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED // REJECTED contribution must not be count
			)
			{
				winnerCounter = winnerCounter.add(1);
			}
		}
		require(winnerCounter > 0); // you cannot revealConsensus if no worker has contributed to this hash

		workorder.status         = Iexec0xLib.WorkOrderStatusEnum.REVEALING;
		workorder.consensusValue = _consensus;
		workorder.revealDeadline = now + 0; //TODO
		workorder.revealCounter  = 0;
		workorder.winnerCounter  = winnerCounter;

		//emit RevealConsensus(_woid, _consensus);
	}

	function reveal(
		bytes32 _woid,
		bytes32 _result)
	public // worker
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    >  now                                     );

		Iexec0xLib.Contribution storage contribution = m_contributions[_woid][msg.sender];
		require(contribution.status         == Iexec0xLib.ContributionStatusEnum.CONTRIBUTED);
		require(contribution.resultHash     == workorder.consensusValue                     );
		require(contribution.resultHash     == keccak256(_result                        )   );
		require(contribution.resultSign     == keccak256(_result ^ keccak256(msg.sender))   );

		contribution.status     = Iexec0xLib.ContributionStatusEnum.PROVED;
		workorder.revealCounter = workorder.revealCounter.add(1);

		//emit Reveal(_woid, msg.sender, _result);
	}

	function reopen(
		bytes32 _woid)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealDeadline    <= now
		     && workorder.revealCounter     == 0                                       );

		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].resultHash == workorder.consensusValue)
			{
				m_contributions[_woid][worker].status = Iexec0xLib.ContributionStatusEnum.REJECTED;
			}
		}

		workorder.status         = Iexec0xLib.WorkOrderStatusEnum.ACTIVE;
		workorder.consensusValue = 0x0;
		workorder.revealDeadline = 0;
		workorder.winnerCounter  = 0;

		//emit Reopen(_woid);
	}

	function finalizeWork(
		bytes32 _woid,
		string  _stdout,
		string  _stderr,
		string  _uri)
	public onlyScheduler(_woid)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status            == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline >  now                                     );
		require(workorder.revealCounter     == workorder.winnerCounter
		    || (workorder.revealCounter     >  0  && workorder.revealDeadline <= now)  );

		workorder.status = Iexec0xLib.WorkOrderStatusEnum.COMPLETED;

		/**
		 * Stake and reward management
		 */
		require(marketplace.successWork(_woid));
		// TODO rewards

		//emit FinalizeWork(_woid,_stdout,_stderr,_uri);
	}

	function claimfailed(
		bytes32 _woid)
	public
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];
		require(workorder.status == Iexec0xLib.WorkOrderStatusEnum.ACTIVE
		     || workorder.status == Iexec0xLib.WorkOrderStatusEnum.REVEALING);
		require(workorder.consensusDeadline <= now);

		workorder.status = Iexec0xLib.WorkOrderStatusEnum.FAILLED;

		/**
		 * Stake management
		 */
		require(marketplace.failedWork(_woid));
		for (uint256 i = 0; i < workorder.contributors.length; ++i)
		{
			address worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status != Iexec0xLib.ContributionStatusEnum.AUTHORIZED) // Contributed, proved or rejected
			{
				require(marketplace.unlockContribution(_woid, worker));
			}
		}

		/* emit WorkOrderClaimed(_woid); */
	}

	function distributeRewards(bytes32 _woid) private returns (bool)
	{
		Iexec0xLib.WorkOrder storage workorder = m_workorders[_woid];

		uint256 i;
		address worker;

		uint256 workerWeight;
		uint256 totalWeight;
		uint256 totalReward = marketplace.viewDeal(_woid).pool.price;
		uint256 workerStake = marketplace.viewDeal(_woid).workerStake;

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			Iexec0xLib.Contribution storage c = m_contributions[_woid][worker];
			if (c.status == Iexec0xLib.ContributionStatusEnum.PROVED)
			{
				totalWeight  = totalWeight.add(c.weight);
			}
			else // ContributionStatusEnum.REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				totalReward = totalReward.add(workerStake);
			}
		}
		require(totalWeight > 0);

		// compute how much is going to the workers
		uint256 workersReward = totalReward.percentage(uint256(100).sub(marketplace.viewDeal(_woid).schedulerRewardRatio));

		for (i = 0; i<workorder.contributors.length; ++i)
		{
			worker = workorder.contributors[i];
			if (m_contributions[_woid][worker].status == Iexec0xLib.ContributionStatusEnum.PROVED)
			{
				uint256 workerReward = workersReward.mulByFraction(m_contributions[_woid][worker].weight, totalWeight);
				totalReward          = totalReward.sub(workerReward);

				require(marketplace.unlockContribution   (_woid, worker));
				require(marketplace.rewardForContribution(_woid, worker, workerReward));
				// TODO increase score
			}
			else // WorkStatusEnum.POCO_REJECT or ContributionStatusEnum.CONTRIBUTED (not revealed)
			{
				// No Reward
				require(marketplace.seizeContribution(_woid, worker));
				// TODO decrease score
			}
		}
		// totalReward now contains the scheduler share
		require(marketplace.rewardForScheduling(_woid, totalReward));

		return true;
	}


}
