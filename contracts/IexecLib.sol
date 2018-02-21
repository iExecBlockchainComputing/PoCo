pragma solidity ^0.4.18;

library IexecLib
{
	/***************************************************************************/
	/*                              Status Enums                               */
	/***************************************************************************/
	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		PENDING,   // Work order submited by user
		CANCELLED, // Work order cancelled by user (before acceptance by a scheduler)
		SCHEDULED,
		REVEALING,
		CLAIMED,
		COMPLETED
	}

	enum ContributionStatusEnum
	{
		UNSET,
		SCHEDULED,
		CONTRIBUTED,
		PROVED,
		REJECTED
	}

	/***************************************************************************/
	/*                                Strcutres                                */
	/***************************************************************************/

	/**
	 * Meta info about consensus
	 * used in WorkerPool.sol
	 */
	struct ConsensusInfo
	{
		uint256             poolReward;
		uint256             stakeAmount;
		bytes32             consensus;
		uint256             revealDate;
		uint256             revealCounter;
		uint256             consensusTimout;
		address[]           contributors;
		uint256             winnerCount;
	}

	/**
	 * Contribution entry
	 * used by WorkerPool.sol
	 */
	struct Contribution
	{
		ContributionStatusEnum status;
		bytes32                resultHash;
		bytes32                resultSign; // change from salt to tx.origin based signature
		address                enclaveChallenge;
		uint256                weight;
	}

	/**
	 * Meta info about workorders
	 * used by IexecHub.sol
	 */
	struct WorkOrderInfo
	{
		address requesterAffectation;
		address workerPoolAffectation;
		address appAffectation;
		address datasetAffectation;
		uint256 userCost;
	}



}
