pragma solidity ^0.4.21;
import './IexecLib.sol';
import './IexecHubAccessor.sol';
import './WorkerPool.sol';
import "./SafeMathOZ.sol";
import './IexecCallbackInterface.sol';

contract Marketplace is IexecHubAccessor
{
	using SafeMathOZ for uint256;

	/**
	 * Marketplace
	 */
	uint                                 public m_orderCount;
	mapping(uint =>IexecLib.MarketOrder) public m_orderBook;

	uint256 public constant ASK_STAKE_RATIO  = 30;

	/**
	 * Events
	 */
	event MarketOrderCreated   (uint marketorderIdx);
	event MarketOrderClosed    (uint marketorderIdx);
	event MarketOrderAskConsume(uint marketorderIdx, address requester);

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
		uint256 _value,
		address _workerpool,
		uint256 _volume)
	public returns (uint)
	{
		require(iexecHubInterface.existingCategory(_category));
		require(_volume >0);
		m_orderCount = m_orderCount.add(1);
		IexecLib.MarketOrder storage marketorder    = m_orderBook[m_orderCount];
		marketorder.direction      = _direction;
		marketorder.category       = _category;
		marketorder.trust          = _trust;
		marketorder.value          = _value;
		marketorder.volume         = _volume;
		marketorder.remaining      = _volume;

		if (_direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(WorkerPool(_workerpool).m_owner() == msg.sender);

			require(iexecHubInterface.lockForOrder(msg.sender, _value.percentage(ASK_STAKE_RATIO).mul(_volume))); // mul must be done after percentage to avoid rounding errors
			marketorder.workerpool      = _workerpool;
			marketorder.workerpoolOwner = msg.sender;
		}
		else
		{
			// no BID implementation
			revert();
		}
		emit MarketOrderCreated(m_orderCount);
		return m_orderCount;
	}

	function closeMarketOrder(uint256 _marketorderIdx) public returns (bool)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		if (marketorder.direction == IexecLib.MarketOrderDirectionEnum.ASK)
		{
			require(marketorder.workerpoolOwner == msg.sender);
			require(iexecHubInterface.unlockForOrder(marketorder.workerpoolOwner, marketorder.value.percentage(ASK_STAKE_RATIO).mul(marketorder.remaining))); // mul must be done after percentage to avoid rounding errors
		}
		else
		{
			// no BID implementation
			revert();
		}
		marketorder.direction = IexecLib.MarketOrderDirectionEnum.CLOSED;
		emit MarketOrderClosed(_marketorderIdx);
		return true;
	}


	/**
	 * Assets consumption
	 */
	function consumeMarketOrderAsk(
		uint256 _marketorderIdx,
		address _requester,
		address _workerpool)
	public onlyIexecHub returns (bool)
	{
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		require(marketorder.direction  == IexecLib.MarketOrderDirectionEnum.ASK);
		require(marketorder.remaining  >  0);
		require(marketorder.workerpool == _workerpool);

		marketorder.remaining = marketorder.remaining.sub(1);
		if (marketorder.remaining == 0)
		{
			marketorder.direction = IexecLib.MarketOrderDirectionEnum.CLOSED;
		}
		require(iexecHubInterface.lockForOrder(_requester, marketorder.value));
		emit MarketOrderAskConsume(_marketorderIdx, _requester);
		return true;
	}

	function existingMarketOrder(uint256 _marketorderIdx) public view  returns (bool marketOrderExist)
	{
		return m_orderBook[_marketorderIdx].category > 0;
	}

	/**
	 * Views
	 */
	function getMarketOrderValue(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx)); // no silent value returned
		return m_orderBook[_marketorderIdx].value;
	}
	function getMarketOrderWorkerpoolOwner(uint256 _marketorderIdx) public view returns (address)
	{
		require(existingMarketOrder(_marketorderIdx)); // no silent value returned
		return m_orderBook[_marketorderIdx].workerpoolOwner;
	}
	function getMarketOrderCategory(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx)); // no silent value returned
		return m_orderBook[_marketorderIdx].category;
	}
	function getMarketOrderTrust(uint256 _marketorderIdx) public view returns (uint256)
	{
		require(existingMarketOrder(_marketorderIdx)); // no silent value returned
		return m_orderBook[_marketorderIdx].trust;
	}
	function getMarketOrder(uint256 _marketorderIdx) public view returns
	(
		IexecLib.MarketOrderDirectionEnum direction,
		uint256 category,       // runtime selection
		uint256 trust,          // for PoCo
		uint256 value,          // value/cost/price
		uint256 volume,         // quantity of instances (total)
		uint256 remaining,      // remaining instances
		address workerpool,     // BID can use null for any
		address workerpoolOwner)
	{
		require(existingMarketOrder(_marketorderIdx)); // no silent value returned
		IexecLib.MarketOrder storage marketorder = m_orderBook[_marketorderIdx];
		return (
			marketorder.direction,
			marketorder.category,
			marketorder.trust,
			marketorder.value,
			marketorder.volume,
			marketorder.remaining,
			marketorder.workerpool,
			marketorder.workerpoolOwner
		);
	}

	/**
	 * Callback Proof managment
	 */

	event WorkOrderCallbackProof(address indexed woid, address requester, address beneficiary,address indexed callbackTo, address indexed gasCallbackProvider,string stdout, string stderr , string uri);

	//mapping(workorder => bool)
	 mapping(address => bool) m_callbackDone;

	 function isCallbackDone(address _woid) public view  returns (bool callbackDone)
	 {
		 return m_callbackDone[_woid];
	 }

	 function workOrderCallback(address _woid,string _stdout, string _stderr, string _uri) public
	 {
		 require(iexecHubInterface.isWoidRegistred(_woid));
		 require(!isCallbackDone(_woid));
		 m_callbackDone[_woid] = true;
		 require(WorkOrder(_woid).m_status() == IexecLib.WorkOrderStatusEnum.COMPLETED);
		 require(WorkOrder(_woid).m_resultCallbackProof() == keccak256(_stdout,_stderr,_uri));
		 address callbackTo =WorkOrder(_woid).m_callback();
		 require(callbackTo != address(0));
		 require(IexecCallbackInterface(callbackTo).workOrderCallback(
			 _woid,
			 _stdout,
			 _stderr,
			 _uri
		 ));
		 emit WorkOrderCallbackProof(_woid,WorkOrder(_woid).m_requester(),WorkOrder(_woid).m_beneficiary(),callbackTo,tx.origin,_stdout,_stderr,_uri);
	 }

}
