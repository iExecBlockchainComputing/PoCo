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
	 * used by IexecHub.sol
	 */
	enum PositionTypeEnum { UNSET, BID, ASK, CANCELED, MARKETED }
	struct Position
	{
		PositionTypeEnum positionType;
		uint256          categorie;     // runtime selection
		uint256          trust;         // for PoCo
		uint256          value;         // value/cost/price
		uint256          quantity;      // ASK only
		address          requester;     // null for ASK
		address          app;           // null for ASK
		address          dataset;       // null for ASK or is no dataset
		address          workerpool;    // BID can use null for any
		string           woParams;      // workorder param (BID only)
		address          woBeneficiary; // (BID only)
		bool             woCallback;    // (BID only)
		uint256          locked;        // (BID only)
		address          workorder;     // (BID only)
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
