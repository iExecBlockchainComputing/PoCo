pragma solidity ^0.4.18;
import './IexecHub.sol';

contract Dapp //Owned by a D(w){
{
	address public owner;
  address private iexecHubAddress;
  IexecHub private iexecHub;

  string  public dappName;
	uint256 public dappPrice;
	string public dappParam;
	string public dappUri;

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
	  //TODO add OPEN and CLOSE STATUS for dappUri maintenance

	//constructor
	function Dapp(address _iexecHubAddress, string _dappName, uint256 _dappPrice, string _dappParam, string _dappUri) public
	{
		// tx.origin == owner
    // msg.sender == DatasetHub
    require(tx.origin != msg.sender );
    owner = tx.origin;
    iexecHubAddress  = _iexecHubAddress;
    iexecHub         = IexecHub(iexecHubAddress);
    dappName         = _dappName;
		dappPrice        = _dappPrice;
		dappParam	       = _dappParam;
		dappUri					 = _dappUri;
	}



}
