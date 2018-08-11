pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

library Iexec0xLib
{
	/**
	* Tools
	*/
	struct Account
	{
		uint256 stake;
		uint256 locked;
	}
	struct Category
	{
		string  name;
		string  description;
		uint256 workClockTimeRef;
	}

	/**
	 * Generic
	 */
	struct signature
	{
		uint8   v;
		bytes32 r;
		bytes32 s;
	}

	/**
	 * Marketplace - Orders
	 */
	struct DappOrder
	{
		// market
		address   dapp;
		uint256   dappprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sign;
	}
	struct DataOrder
	{
		// market
		address   data;
		uint256   dataprice;
		uint256   volume;
		// extra
		bytes32   salt;
		signature sign;
	}
	struct PoolOrder
	{
		// market
		address   pool;
		uint256   poolprice;
		uint256   volume;
		// settings
		uint256   category;
		uint256   trust;
		uint256   tag;
		// extra
		bytes32   salt;
		signature sign;
	}
	struct UserOrder
	{
		// market
		/* address[3] ressources; */
		/* uint256[3] maxprices; */
		address   dapp;
		uint256   dappmaxprice;
		address   data;
		uint256   datamaxprice;
		address   pool;
		uint256   poolmaxprice;
		address   requester;
		// settings
		uint256   category;
		uint256   trust;
		uint256   tag;
		/* uint256   batchsize; */
		address   beneficiary;
		address   callback;
		string    params;
		// extra
		bytes32   salt;
		signature sign;
	}
	/**
	 * Marketplace - Deals
	 */
	struct Resource
	{
		address pointer;
		address owner;
		uint256 price;
	}
	struct Deal
	{
		// Ressources
		Resource dapp;
		Resource data;
		Resource pool;
		// execution settings
		uint256 category;
		uint256 trust;
		uint256 tag;
		// bag of task
		/* uint256 batchsize; */
		/* uint256 batchoffset; */
		// execution details
		address requester;
		address beneficiary;
		address callback;
		string  params;
		// other settings
		uint256 workerStake;
		uint256 schedulerRewardRatio;
	}

	/**
	 * Workorders
	 */
	enum WorkOrderStatusEnum
	{
		UNSET,     // Work order not yet initialized (invalid address)
		ACTIVE,    // Marketed → constributions are open
		REVEALING, // Starting consensus reveal
		COMPLETED, // Concensus achieved
		FAILLED    // Failled consensus
	}
	struct WorkOrder
	{
		WorkOrderStatusEnum status;
		bytes32   consensusValue;
		uint256   consensusDeadline;
		uint256   revealDeadline;
		uint256   revealCounter;
		uint256   winnerCounter;
		address[] contributors;
	}

	/**
	 * Consensus
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
		bytes32 resultSign;
		address enclaveChallenge;
		uint256 score;
		uint256 weight;
	}


}
