pragma solidity ^0.4.21;

library IexecLib
{
	/***************************************************************************/
	/*                              Market Order                               */
	/***************************************************************************/
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
		uint256 category;        // runtime selection
		uint256 trust;           // for PoCo
		// uint256 marketDeadline;  // deadline for market making
		// uint256 assetDeadline;   // deadline for work submission
		uint256 value;           // value/cost/price
		uint256 volume;          // quantity of instances (total)
		uint256 remaining;       // remaining instances
		// address requester;       // null for ASK
		address workerpool;      // BID can use null for any
		address workerpoolOwner; // BID can use null for any
	}

	/***************************************************************************/
	/*                               Work Order                                */
	/***************************************************************************/
	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		CLAIMED,   // Failled consensus
		COMPLETED  // Concensus achieved
	}

	/***************************************************************************/
	/*                                Consensus                                */
	/*                                   ---                                   */
	/*                         used in WorkerPool.sol                          */
	/***************************************************************************/
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

	/***************************************************************************/
	/*                              Contribution                               */
	/*                                   ---                                   */
	/*                         used in WorkerPool.sol                          */
	/***************************************************************************/
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
		bytes32 resultSign;
		address enclaveChallenge;
		uint256 score;
		uint256 weight;
	}

	/***************************************************************************/
	/*                Account / ContributionHistory / Category                 */
	/*                                   ---                                   */
	/*                          used in IexecHub.sol                           */
	/***************************************************************************/
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

	struct Category
	{
		uint256 catid;
		string  name;
		string  description;
		uint256 workClockTimeRef;
	}

}
