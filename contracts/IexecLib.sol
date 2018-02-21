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
		ACCEPTED,  // Work accepted by scheduler
		REVEALING, // Starting consensus reveal
		CLAIMED,   // Failled consensus
		COMPLETED  // Concensus achieved
	}

	enum ContributionStatusEnum
	{
		UNSET,
		AUTHORIZED,
		CONTRIBUTED,
		PROVED,
		REJECTED
	}

	/***************************************************************************/
	/*                               Structures                                */
	/***************************************************************************/

	/**
	 * Meta info about workorders
	 * used by IexecHub.sol
	 */
	struct WorkOrderInfo
	{
		address appAffectation;
		address datasetAffectation;
		address requesterAffectation;
		address workerPoolAffectation;
		uint256 userCost;
	}

	/**
	 * Meta info about consensus
	 * used in WorkerPool.sol
	 */
	struct ConsensusInfo
	{
		uint256 poolReward;
		uint256 stakeAmount;
		bytes32 consensus;
		uint256 revealDate;
		uint256 revealCounter;
		uint256 consensusTimout;
		uint256 winnerCount;
		address[] contributors;
	}

	/**
	 * Contribution entry
	 * used by WorkerPool.sol
	 */
	struct Contribution
	{
		ContributionStatusEnum status;
		bytes32 resultHash;
		bytes32 resultSign; // change from salt to tx.origin based signature
		address enclaveChallenge;
		uint256 weight;
	}

}
