pragma solidity ^0.4.18;
import './IexecLib.sol';
contract MarketplaceInterface  {


  function emitMarketOrder(
    IexecLib.MarketOrderDirectionEnum _direction,
    uint256 _category,
    uint256 _trust,
    uint256 _marketDeadline,
    uint256 _assetDeadline,
    uint256 _value,
    address _workerpool,
    uint256 _volume)
  public returns (uint);


  function consumMarketOrder( uint256 _marketorderIdx, address _requester, address _workerpool)
  public returns(bool consumed);


   function getMarketOrderValue(uint256 _marketorderIdx) public view returns(uint256 value);

   function getMarketOrderTrust(uint256 _marketorderIdx) public view returns(uint256 value);

   function getMarketOrder(uint256 _marketorderIdx) public view returns(
    IexecLib.MarketOrderDirectionEnum direction,
    uint256 category,       // runtime selection
    uint256 trust,          // for PoCo
    uint256 marketDeadline, // deadline for market making
    uint256 assetDeadline,  // deadline for work submission
    uint256 value,         // value/cost/price
    uint256 volume,         // quantity of instances (total)
    uint256 remaining,      // remaining instances
    address requester,      // null for ASK
    address workerpool     // BID can use null for any
    );

   	function closeMarketOrder(uint256 _marketorderIdx) public returns (bool);

   	function answerBidOrder(uint256 _marketorderIdx, uint256 _quantity, address _workerpool) public returns (uint256);

   	function answerAskOrder(uint _marketorderIdx, uint256 _quantity) public returns (uint256);

   	function redeamUnusedAssets(uint _marketorderIdx, address _user, address _workerpool) public returns (bool);
   /*
   	function transferAsset(uint _marketorderIdx, address _user, address _workerpool, address _newowner) public returns (bool);
   */

}
