pragma solidity ^0.4.21;

library IexecLib
{
	/***************************************************************************/
	/*                             Market Matching                             */
	/***************************************************************************/
	struct MarketMatching
	{
		/********** Order settings **********/
		uint256 common_category;
		uint256 common_trust;
		uint256 common_value;
		/********** Pool settings **********/
		uint256 pool_volume;
		address pool_workerpool;
		address pool_workerpoolOwner;
		uint256 pool_salt;
		/********** User settings **********/
		address user_app;
		address user_dataset;
		address user_callback;
		address user_beneficiary;
		address user_requester;
		string  user_params;
		uint256 user_salt;
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
		address workerpoolOwner;
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
