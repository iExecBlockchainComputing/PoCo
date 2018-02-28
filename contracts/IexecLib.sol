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
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		CLAIMED,   // Failled consensus
		COMPLETED  // Concensus achieved
	}
	/***************************************************************************/
	/*                               Structures                                */
	/***************************************************************************/
	/**
	 * used by IexecHub.sol
	 */
	enum MarketOrderDirectionEnum
	{
		UNSET,
		BID,
		ASK,
		CLOSED
	}
	struct MarketOrder
	{
		MarketOrderDirectionEnum direction;
		uint256 category;       // runtime selection
		uint256 trust;          // for PoCo
		// uint256 marketDeadline; // deadline for market making
		// uint256 assetDeadline;  // deadline for work submission
		uint256 value;          // value/cost/price
		uint256 volume;         // quantity of instances (total)
		uint256 remaining;      // remaining instances
		// address requester;      // null for ASK
		address workerpool;     // BID can use null for any
	}

	/**
	 * Meta info about consensus
	 * used in WorkerPool.sol
	 */
	struct Consensus
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
	enum ContributionStatusEnum
	{
		UNSET,
		AUTHORIZED,
		CONTRIBUTED,
		PROVED,
		REJECTED
	}
	struct Contribution
	{
		ContributionStatusEnum status;
		bytes32 resultHash;
		bytes32 resultSign; // change from salt to tx.origin based signature
		address enclaveChallenge;
		uint256 weight;
	}

	struct Account
	{
		uint256 stake;
		uint256 locked;
	}
	struct ContributionHistory // for credibility computation, f = failled/total
	{
		uint256 success;
		uint256 failled;
	}

}
