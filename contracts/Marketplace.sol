pragma solidity ^0.4.18;
import './IexecLib.sol';
import './IexecHubAccessor.sol';
import './WorkerPool.sol';
import "./SafeMathOZ.sol";

contract Marketplace is IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/**
	 * Marketplace
	 */
	// Array of positions
	uint                                 public m_orderCount;
	mapping(uint =>IexecLib.MarketOrder) public m_orderBook;

	// marketorderIdx => user => workerpool => quantity
	/* mapping(uint => mapping(address => mapping(address => uint))) public m_assetBook; */

	/**
	 * Events
	 */
	event MarketOrderEmitted   (uint marketorderIdx);
	event MarketOrderClosed    (uint marketorderIdx);
	event MarketOrderAskConsume(uint marketorderIdx, address requester);
	/* event MarketOrderBidAnswered(uint marketorderIdx, address requester, address workerpool, uint256 quantity); */
	/* event MarketOrderAskAnswered(uint marketorderIdx, address requester, address workerpool, uint256 quantity); */
	/* event UnusedAssetsClaimed */
	/* event AssetTransfered */

	/**
	 * Constructor
	 */
	function Marketplace(address _iexecHubAddress)
	IexecHubAccessor(_iexecHubAddress)
	public
	{
	}

	/**
	 * Market orders
	 */
	function createMarketOrder(
		IexecLib.MarketOrderDirectionEnum _direction,
		uint256 _category,
		uint256 _trust,
		/* uint256 _marketDeadline, */
		/* uint256 _assetDeadline, */
		uint256 _value,
		address _workerpool,
		uint256 _volume)
	public returns (uint)
	{
		require(iexecHubInterface.existingCategory(_category));
		require(_volume >0);
		/* require(_assetDeadline >= _marketDeadline); */
		m_orderCount = m_orderCount.add(1);
		// marketorderIdx = m_orderCount;
		IexecLib.MarketOrder storage marketorder    = m_orderBook[m_orderCount];
		marketorder.direction      = _direction;
		marketorder.category       = _category;
		marketorder.trust          = _trust;
		/* marketorder.marketDeadline = _marketDeadline; */
		/* marketorder.assetDeadline  = _assetDeadline; */
		marketorder.value          = _value;
		marketorder.volume         = _volume;
		marketorder.remaining      = _volume;

		/*
		if (_direction == IexecLib.MarketOrderDirectionEnum.BID)
		{
			require(iexecHubInterface.lockForOrder(msg.sender, _value.mul(_volume)));
			marketorder.requester  = msg.sender;
			marketorder.workerpool = _workerpool;
		}
		else
		*/
		if (_direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(WorkerPool(_workerpool).m_owner() == msg.sender);
			require(iexecHubInterface.lockForOrder(msg.sender, _value.mul(_volume)));
			/* marketorder.requester  = address(0); */
			marketorder.workerpool      = _workerpool;
			marketorder.workerpoolOwner = msg.sender;
		}
		else
		{
			revert();
		}
		MarketOrderEmitted(m_orderCount);
		return m_orderCount;
	}

	function closeMarketOrder(uint256 _marketorderIdx) public returns (bool)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		/*
		if (marketorder.direction == IexecLib.MarketOrderDirectionEnum.BID)
		{
			require(marketorder.requester == msg.sender);
			require(iexecHubInterface.unlockForOrder(msg.sender, marketorder.value.mul(marketorder.remaining)));
		}
		else
		*/
		if (marketorder.direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(marketorder.workerpoolOwner == msg.sender);
			require(iexecHubInterface.unlockForOrder(marketorder.workerpoolOwner, marketorder.value.mul(marketorder.remaining)));
		}
		else
		{
			revert();
		}
		marketorder.direction = IexecLib.MarketOrderDirectionEnum.CLOSED;
		MarketOrderClosed(_marketorderIdx);
		return true;
	}
	/*
	function answerBidOrder(uint256 _marketorderIdx, uint256 _quantity, address _workerpool) public returns (uint256)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.direction == IexecLib.MarketOrderDirectionEnum.BID);
		require(marketorder.marketDeadline > now);
		require(WorkerPool(_workerpool).m_owner() == msg.sender);
		require(marketorder.workerpool == address(0) || marketorder.workerpool == _workerpool);
		_quantity.min256(marketorder.remaining);
		marketorder.remaining = marketorder.remaining.sub(_quantity);
		if (marketorder.remaining == 0)
		{
			marketorder.direction == IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		// marketorderIdx => user => workerpool => quantity
		m_assetBook[_marketorderIdx][marketorder.requester][_workerpool] = m_assetBook[_marketorderIdx][marketorder.requester][_workerpool].add(_quantity);
		MarketOrderBidAnswered(_marketorderIdx, marketorder.requester, _workerpool, _quantity);
		return _quantity;
	}
	function answerAskOrder(uint _marketorderIdx, uint256 _quantity) public returns (uint256)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.direction == IexecLib.MarketOrderDirectionEnum.ASK);
		require(marketorder.marketDeadline > now);
		_quantity = _quantity.min256(marketorder.remaining);
		marketorder.remaining = marketorder.remaining.sub(_quantity);
		if (marketorder.remaining == 0)
		{
			marketorder.direction == IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		require(iexecHubInterface.lockForOrder(msg.sender, marketorder.value.mul(_quantity)));
		// marketorderIdx => user => workerpool => quantity
		m_assetBook[_marketorderIdx][msg.sender][marketorder.workerpool] = m_assetBook[_marketorderIdx][msg.sender][marketorder.workerpool].add(_quantity);
		MarketOrderAskAnswered(_marketorderIdx, msg.sender, marketorder.workerpool, _quantity);
		return _quantity;
	}
	*/

	/**
	 * Assets consumption
	 */
	function answerConsume(
		uint256 _marketorderIdx,
		address _requester,
		address _workerpool)
	public onlyIexecHub returns (bool)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.direction  == IexecLib.MarketOrderDirectionEnum.ASK);
		require(marketorder.remaining  >  0);
		require(marketorder.workerpool == _workerpool);
		/* require(marketorder.marketDeadline >  now); // assetDeadline > marketdeadline > now */

		marketorder.remaining = marketorder.remaining.sub(1);
		if (marketorder.remaining == 0)
		{
			marketorder.direction = IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		require(iexecHubInterface.lockForOrder(_requester, marketorder.value));
		MarketOrderAskConsume(_marketorderIdx, _requester);
		return true;
	}
	/*
	function useConsume(
		uint256 _marketorderIdx,
		address _requester,
		address _workerpool)
	public onlyIexecHub returns (bool)
	{
		require(m_assetBook[_marketorderIdx][_requester][_workerpool] > 0);
		require(m_orderBook[_marketorderIdx].assetDeadline > now);

		m_assetBook[_marketorderIdx][_requester][_workerpool] = m_assetBook[_marketorderIdx][_requester][_workerpool].sub(1);
		// TODO: create event
		return true;
		//   return m_orderBook[_marketorderIdx];// issue :https://github.com/ethereum/solidity/issues/3516
	}
	*/

	/**
	 * Assets management
	 */
	/*
	function redeamUnusedAssets(uint _marketorderIdx, address _user, address _workerpool) public returns (bool)
	{
		require(WorkerPool(_workerpool).m_owner() == msg.sender);
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.assetDeadline <= now);
		uint quantity = m_assetBook[_marketorderIdx][_user][_workerpool];
		uint value    = marketorder.value.mul(quantity);
		m_assetBook[_marketorderIdx][_user][_workerpool] = 0; // delete asset
		require(iexecHubInterface.seizeForOrder (_user,      value)); // Take the locked funds from the user
		require(iexecHubInterface.rewardForOrder(msg.sender, value)); // Give the funds to the workerpool owner
		// TODO: create event
		return true;
	}

	function transferAsset(uint _marketorderIdx, address _user, address _workerpool, address _newowner) public returns (bool)
	{
		require(_user == msg.sender);
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.assetDeadline > now);
		uint quantity = m_assetBook[_marketorderIdx][_user][_workerpool];
		uint value    = marketorder.value.mul(quantity);
		m_assetBook[_marketorderIdx][_newowner][_workerpool] = m_assetBook[_marketorderIdx][_newowner][_workerpool].add(quantity); // give asset to new owner
		m_assetBook[_marketorderIdx][_user    ][_workerpool] = 0; // remove asset from old user
		require(iexecHubInterface.seizeForOrder (_user,     value)); // Take the locked funds from the user
		require(iexecHubInterface.rewardForOrder(_newowner, value));  // Give the funds to the new owner ...
		require(iexecHubInterface.lockForOrder  (_newowner, value));  // ... and lock them
		// TODO: create event
		return true;
	}
	*/

	function existingMarketOrder(uint256 _marketorderIdx) public view  returns (bool marketOrderExist){
		return m_orderBook[_marketorderIdx].category > 0;
	}

	/**
	 * Views
	 */
	function getMarketOrderValue(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx));//no silent value returned
		return m_orderBook[_marketorderIdx].value;
	}
	function getMarketOrderCategory(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx));//no silent value returned
		return m_orderBook[_marketorderIdx].category;
	}
	function getMarketOrderTrust(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx));//no silent value returned
		return m_orderBook[_marketorderIdx].trust;
	}
	function getMarketOrder(uint256 _marketorderIdx) public view returns
	(
		IexecLib.MarketOrderDirectionEnum direction,
		uint256 category,       // runtime selection
		uint256 trust,          // for PoCo
		/* uint256 marketDeadline, // deadline for market making */
		/* uint256 assetDeadline,  // deadline for work submission */
		uint256 value,          // value/cost/price
		uint256 volume,         // quantity of instances (total)
		uint256 remaining,      // remaining instances
		/* address requester,      // null for ASK */
		address workerpool,      // BID can use null for any
		address workerpoolOwner)
	{
		require(existingMarketOrder(_marketorderIdx));//no silent value returned
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		return (
			marketorder.direction,
			marketorder.category,
			marketorder.trust,
			/* marketorder.marketDeadline, */
			/* marketorder.assetDeadline, */
			marketorder.value,
			marketorder.volume,
			marketorder.remaining,
			/* marketorder.requester, */
			marketorder.workerpool,
			marketorder.workerpoolOwner
		);
	}

}
