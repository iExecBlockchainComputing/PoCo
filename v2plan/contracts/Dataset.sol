pragma solidity ^0.4.18;
import './IexecHub.sol';
contract Dataset{

  address public owner;
  address private iexecHubAddress;
  IexecHub private iexecHub;

  string  public datasetName;
  uint256 public datasetPrice;
  string public datasetParam;
  string public datasetUri;

  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

	modifier onlyIexecHub()
	{
		require(msg.sender == iexecHubAddress);
		_;
	}

  //TODO add black and white listing possible by owner
  //TODO add OPEN and CLOSE STATUS for datasetUri maintenance


 //constructor
 function Dataset(address _iexecHubAddress, string _datasetName, uint256 _datasetPrice, string _datasetParam, string _datasetUri) public
 {
   // tx.origin == owner
   // msg.sender == DatasetHub
   require(tx.origin != msg.sender );
   owner = tx.origin;
   iexecHubAddress  = _iexecHubAddress;
   iexecHub         = IexecHub(iexecHubAddress);
   datasetName             = _datasetName;
   datasetPrice             = _datasetPrice;
   datasetParam             = _datasetParam;
   datasetUri             = _datasetUri;
 }
}
